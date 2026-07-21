import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
  Linking,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useHistory, type ConversationTurnEntry } from "@/contexts/HistoryContext";
import { useTranscribeAudio, useTranslateText } from "@workspace/api-client-react";
import LanguageSelector from "@/components/LanguageSelector";
import { LANGUAGES } from "@/constants/languages";
import { speak, stopSpeaking } from "@/lib/speech";
import {
  IDLE_STATE,
  transition,
  TranslationCache,
  type ConversationSide,
  type ConversationState,
} from "@/lib/conversation-machine";

const MAX_RECORDING_SECONDS = 60;

type Turn = ConversationTurnEntry & {
  id: string;
  status: "done" | "error";
  /** Kept for retry after a network failure. */
  pendingAudioBase64?: string;
};

export default function ConversationMode() {
  const colors = useColors();
  const { addEntry } = useHistory();

  const [state, setState] = useState<ConversationState>(IDLE_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [topLanguage, setTopLanguage] = useState("Spanish");
  const [bottomLanguage, setBottomLanguage] = useState("English");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [micDenied, setMicDenied] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [openSelector, setOpenSelector] = useState<ConversationSide | null>(null);
  const [saved, setSaved] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  // Incremented on every teardown; in-flight async turns compare their
  // captured value and bail out silently if the session was cancelled.
  const sessionRef = useRef(0);
  const cacheRef = useRef(new TranslationCache());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<Turn>>(null);

  const transcribeMutation = useTranscribeAudio();
  const translateMutation = useTranslateText();

  const dispatch = useCallback((event: Parameters<typeof transition>[1]): boolean => {
    const next = transition(stateRef.current, event);
    if (next === null) return false; // illegal transition — ignore the tap
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const teardown = useCallback(async () => {
    sessionRef.current++; // invalidate all in-flight turn pipelines
    stopTimer();
    setSeconds(0);
    await stopSpeaking();
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {
        // already unloaded
      }
      const uri = rec.getURI();
      if (uri) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {
      // no-op
    }
    dispatch({ type: "CANCEL" });
  }, [dispatch]);

  // Stop recording/speech when screen loses focus or unmounts
  useFocusEffect(
    useCallback(() => {
      return () => {
        void teardown();
      };
    }, [teardown]),
  );

  // Stop when app backgrounds — a hot mic is a real bug.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") void teardown();
    });
    return () => sub.remove();
  }, [teardown]);

  // ── Turn pipeline ─────────────────────────────────────────────────────────

  const languageFor = (side: ConversationSide) =>
    side === "top" ? topLanguage : bottomLanguage;
  const otherLanguageFor = (side: ConversationSide) =>
    side === "top" ? bottomLanguage : topLanguage;

  const appendTurn = (turn: Turn) => {
    setTurns((prev) => [...prev, turn]);
    setSaved(false);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const processAudio = async (audioBase64: string, side: ConversationSide) => {
    const session = sessionRef.current;
    const cancelled = () => sessionRef.current !== session;
    const sourceLang = languageFor(side);
    const targetLang = otherLanguageFor(side);

    let original = "";
    try {
      const t = await transcribeMutation.mutateAsync({
        data: { audioBase64, mimeType: "audio/m4a" },
      });
      original = t.transcription;
    } catch (err) {
      if (cancelled()) return;
      dispatch({ type: "ERROR" });
      appendTurn({
        id: `${Date.now()}`,
        side,
        original: "",
        translated: "",
        status: "error",
        pendingAudioBase64: audioBase64,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (cancelled()) return;
    dispatch({ type: "TRANSCRIBED" });

    // Session memoization: identical (text, source, target) is never re-translated.
    const cached = cacheRef.current.get(original, sourceLang, targetLang);
    let translated: string;
    if (cached !== undefined) {
      translated = cached;
    } else {
      try {
        const r = await translateMutation.mutateAsync({
          data: { text: original, sourceLanguage: sourceLang, targetLanguage: targetLang },
        });
        translated = r.translatedText;
        cacheRef.current.set(original, sourceLang, targetLang, translated);
      } catch {
        if (cancelled()) return;
        dispatch({ type: "ERROR" });
        appendTurn({ id: `${Date.now()}`, side, original, translated: "", status: "error" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    if (cancelled()) return;
    dispatch({ type: "TRANSLATED" });
    appendTurn({ id: `${Date.now()}`, side, original, translated, status: "done" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Speak in the LISTENER's language. speak() flips the iOS audio session
    // (recording off + silent-mode playback on) before talking.
    await speak(translated, targetLang);
    if (cancelled()) return;
    dispatch({ type: "SPOKEN" });
  };

  const retryTurn = async (turn: Turn) => {
    if (stateRef.current.phase !== "idle") return;
    const session = sessionRef.current;
    const cancelled = () => sessionRef.current !== session;
    setTurns((prev) => prev.filter((t) => t.id !== turn.id));
    if (turn.pendingAudioBase64) {
      if (!dispatch({ type: "START_RECORDING", side: turn.side })) return;
      dispatch({ type: "STOP_RECORDING" }); // straight to transcribing
      await processAudio(turn.pendingAudioBase64, turn.side);
    } else if (turn.original) {
      // transcription succeeded before; only translation failed
      if (!dispatch({ type: "START_RECORDING", side: turn.side })) return;
      dispatch({ type: "STOP_RECORDING" });
      dispatch({ type: "TRANSCRIBED" });
      const sourceLang = languageFor(turn.side);
      const targetLang = otherLanguageFor(turn.side);
      try {
        const r = await translateMutation.mutateAsync({
          data: { text: turn.original, sourceLanguage: sourceLang, targetLanguage: targetLang },
        });
        if (cancelled()) return;
        cacheRef.current.set(turn.original, sourceLang, targetLang, r.translatedText);
        dispatch({ type: "TRANSLATED" });
        appendTurn({
          id: `${Date.now()}`,
          side: turn.side,
          original: turn.original,
          translated: r.translatedText,
          status: "done",
        });
        await speak(r.translatedText, targetLang);
        if (cancelled()) return;
        dispatch({ type: "SPOKEN" });
      } catch {
        if (cancelled()) return;
        dispatch({ type: "ERROR" });
        appendTurn({ ...turn, id: `${Date.now()}` });
      }
    }
  };

  // ── Record / stop ─────────────────────────────────────────────────────────

  const startRecording = async (side: ConversationSide) => {
    // Guard: only legal from idle (blocks double-taps, wrong-side taps,
    // and recording while speaking).
    if (stateRef.current.phase !== "idle") return;

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      setMicDenied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setMicDenied(false);

    // Never listen to ourselves.
    await stopSpeaking();

    if (!dispatch({ type: "START_RECORDING", side })) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      // Exact same recording configuration as the existing STT feature.
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) {
            void stopRecording(); // 60s cap
            return s + 1;
          }
          return s + 1;
        });
      }, 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      dispatch({ type: "CANCEL" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const stopRecording = async () => {
    if (stateRef.current.phase !== "recording") return;
    const side = stateRef.current.activeSide!;
    stopTimer();
    setSeconds(0);

    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) {
      dispatch({ type: "CANCEL" });
      return;
    }

    if (!dispatch({ type: "STOP_RECORDING" })) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let base64: string | null = null;
    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      uri = rec.getURI();
      if (!uri) throw new Error("No recording URI");
      base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    } catch {
      dispatch({ type: "ERROR" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      // Zero temp audio files left on disk after a turn.
      if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }

    if (base64) await processAudio(base64, side);
  };

  const handleSideTap = (side: ConversationSide) => {
    const phase = stateRef.current.phase;
    if (phase === "recording") {
      if (stateRef.current.activeSide === side) void stopRecording();
      // tapping the OTHER side mid-recording is ignored
      return;
    }
    if (phase === "idle") void startRecording(side);
    // all other phases: taps ignored (illegal transitions)
  };

  const handleSave = () => {
    if (turns.length === 0 || saved) return;
    addEntry({
      type: "conversation",
      turns: turns
        .filter((t) => t.status === "done")
        .map(({ side, original, translated }) => ({ side, original, translated })),
      sourceLanguage: bottomLanguage,
      targetLanguage: topLanguage,
    });
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Rendering ─────────────────────────────────────────────────────────────

  const phase = state.phase;
  const activeSide = state.activeSide;
  const busy = phase !== "idle";

  const phaseLabel = (side: ConversationSide): string => {
    if (activeSide !== side) return "";
    switch (phase) {
      case "recording":
        return `Listening… ${MAX_RECORDING_SECONDS - seconds}s`;
      case "transcribing":
        return "Transcribing…";
      case "translating":
        return "Translating…";
      case "speaking":
        return "Speaking…";
      default:
        return "";
    }
  };

  const renderSide = (side: ConversationSide) => {
    const isActive = activeSide === side;
    const dimmed = busy && !isActive;
    const isRecording = phase === "recording" && isActive;
    const label = phaseLabel(side);

    return (
      <View
        style={[
          styles.half,
          side === "top" && styles.halfRotated,
          { opacity: dimmed ? 0.35 : 1 },
        ]}
      >
        <TouchableOpacity
          style={[styles.sideLangChip, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => !busy && setOpenSelector(side)}
          activeOpacity={0.8}
        >
          <Text style={[styles.sideLangText, { color: colors.foreground }]} numberOfLines={1}>
            {languageFor(side)}
          </Text>
          <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.talkButton,
            {
              backgroundColor: isRecording ? colors.destructive : colors.accent,
              borderColor: colors.border,
            },
          ]}
          onPress={() => handleSideTap(side)}
          activeOpacity={0.85}
        >
          <Feather name={isRecording ? "square" : "mic"} size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={[styles.phaseLabel, { color: isRecording ? colors.destructive : colors.mutedForeground }]}>
          {label || "Tap to talk"}
        </Text>
      </View>
    );
  };

  const renderTurn = ({ item }: { item: Turn }) => (
    <View
      style={[
        styles.turnCard,
        {
          backgroundColor: colors.card,
          borderColor: item.status === "error" ? colors.destructive : colors.border,
          alignSelf: item.side === "top" ? "flex-start" : "flex-end",
        },
      ]}
    >
      {item.status === "error" ? (
        <View style={styles.turnErrorRow}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.turnErrorText, { color: colors.destructive }]}>
            {item.original ? "Translation failed" : "Transcription failed"}
          </Text>
          <TouchableOpacity onPress={() => retryTurn(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.turnRetry, { color: colors.accent }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={[styles.turnOriginal, { color: colors.mutedForeground }]}>{item.original}</Text>
          <Text style={[styles.turnTranslated, { color: colors.foreground }]}>{item.translated}</Text>
        </>
      )}
      {item.status === "error" && item.original ? (
        <Text style={[styles.turnOriginal, { color: colors.mutedForeground }]}>{item.original}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderSide("top")}

      <View style={[styles.transcriptWrap, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        {micDenied && (
          <View style={styles.micDeniedRow}>
            <Text style={[styles.micDeniedText, { color: colors.destructive }]}>
              Microphone access denied.
            </Text>
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={[styles.micDeniedLink, { color: colors.destructive }]}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}
        {turns.length === 0 && !micDenied ? (
          <View style={styles.transcriptEmpty}>
            <Text style={[styles.transcriptEmptyText, { color: colors.mutedForeground }]}>
              Tap a mic to start the conversation
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={turns}
            keyExtractor={(t) => t.id}
            renderItem={renderTurn}
            contentContainerStyle={styles.transcriptList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}
        {(phase === "transcribing" || phase === "translating") && (
          <View style={styles.pendingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
        {turns.length > 0 && (
          <TouchableOpacity
            style={[styles.saveBtn, { borderColor: colors.border, backgroundColor: saved ? colors.accent : colors.card }]}
            onPress={handleSave}
            disabled={saved}
            activeOpacity={0.8}
          >
            <Feather name={saved ? "check" : "bookmark"} size={13} color={saved ? "#FFFFFF" : colors.foreground} />
            <Text style={[styles.saveBtnText, { color: saved ? "#FFFFFF" : colors.foreground }]}>
              {saved ? "Saved" : "Save"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {renderSide("bottom")}

      <LanguageSelector
        visible={openSelector !== null}
        onClose={() => setOpenSelector(null)}
        onSelect={(lang) => {
          if (openSelector === "top") setTopLanguage(lang);
          if (openSelector === "bottom") setBottomLanguage(lang);
          setOpenSelector(null);
        }}
        languages={LANGUAGES}
        selected={openSelector === "top" ? topLanguage : bottomLanguage}
        title="Language"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  half: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  halfRotated: {
    transform: [{ rotate: "180deg" }],
  },
  sideLangChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2,
  },
  sideLangText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  talkButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  phaseLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  transcriptWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderWidth: 2,
    borderRadius: 14,
    overflow: "hidden",
  },
  transcriptEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  transcriptEmptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  transcriptList: {
    padding: 12,
    gap: 8,
  },
  turnCard: {
    maxWidth: "85%",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  turnOriginal: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  turnTranslated: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  turnErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  turnErrorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  turnRetry: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  pendingRow: {
    padding: 8,
    alignItems: "center",
  },
  micDeniedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
  },
  micDeniedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  micDeniedLink: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  saveBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
