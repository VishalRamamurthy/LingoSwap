import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTranslateText, useTranscribeAudio } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useHistory } from "@/contexts/HistoryContext";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import { LANGUAGES } from "@/constants/languages";
import { COUNTRY_TO_LANGUAGE } from "@/constants/countryLanguages";
import LanguageSelector from "@/components/LanguageSelector";
import SpeakerButton from "@/components/SpeakerButton";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";

type Mode = "voice" | "text";
type RecordingState = "idle" | "recording" | "processing";

export default function TranslateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("voice");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [sourceText, setSourceText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState(false);
  const [isTargetSelectorOpen, setIsTargetSelectorOpen] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Correlates each translation request so a stale response can never
  // overwrite the result/history of a newer one.
  const translationRequestIdRef = useRef(0);
  const userChangedTargetRef = useRef(false);
  const { addEntry } = useHistory();

  // Location-based target language suggestion (runs once on launch)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        });
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        const countryCode = places[0]?.isoCountryCode?.toUpperCase();
        if (!countryCode) return;
        const language = COUNTRY_TO_LANGUAGE[countryCode];
        if (language && !cancelled && !userChangedTargetRef.current) {
          setTargetLanguage(language);
        }
      } catch {
        // Location unavailable — keep the default target language
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateMutation = useTranslateText();
  const transcribeMutation = useTranscribeAudio();

  const params = useLocalSearchParams<{
    restoreText?: string;
    restoreSourceLang?: string;
    restoreTargetLang?: string;
    restoreTranslatedText?: string;
  }>();
  const router = useRouter();

  // Ripple animation for recording state
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const micScale = useSharedValue(1);

  useEffect(() => {
    if (recordingState === "recording") {
      ripple1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 })
        ),
        -1
      );
      ripple2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 500 }),
          withTiming(1, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 })
        ),
        -1
      );
      micScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    } else {
      cancelAnimation(ripple1);
      cancelAnimation(ripple2);
      cancelAnimation(micScale);
      ripple1.value = withTiming(0, { duration: 300 });
      ripple2.value = withTiming(0, { duration: 300 });
      micScale.value = withTiming(1, { duration: 200 });
    }
  }, [recordingState]);

  const ripple1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple1.value, [0, 0.5, 1], [0.4, 0.2, 0]),
    transform: [{ scale: interpolate(ripple1.value, [0, 1], [1, 1.8]) }],
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple2.value, [0, 0.5, 1], [0.3, 0.15, 0]),
    transform: [{ scale: interpolate(ripple2.value, [0, 1], [1, 2.3]) }],
  }));

  const micScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  useEffect(() => {
    if (params.restoreText) {
      setSourceText(params.restoreText);
      setSourceLanguage(params.restoreSourceLang || "auto");
      setTargetLanguage(params.restoreTargetLang || "English");
      setTranslatedText(params.restoreTranslatedText || "");
      setDetectedLang("");
      setMode("text");
      router.setParams({
        restoreText: "",
        restoreSourceLang: "",
        restoreTargetLang: "",
        restoreTranslatedText: "",
      });
    }
  }, [params, router]);

  const clearResult = () => {
    setSourceText("");
    setTranslatedText("");
    setDetectedLang("");
    translateMutation.reset();
    transcribeMutation.reset();
  };

  const runTranslation = (text: string, isVoice: boolean) => {
    const requestId = ++translationRequestIdRef.current;
    translateMutation.mutate(
      {
        data: {
          text,
          sourceLanguage: sourceLanguage === "auto" ? undefined : sourceLanguage,
          targetLanguage,
        },
      },
      {
        onSuccess: (data) => {
          if (requestId !== translationRequestIdRef.current) return;
          setTranslatedText(data.translatedText);
          setDetectedLang(data.detectedLanguage);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          addEntry({
            sourceText: text,
            translatedText: data.translatedText,
            sourceLanguage:
              sourceLanguage === "auto" ? data.detectedLanguage : sourceLanguage,
            targetLanguage,
            isVoice,
          });
        },
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  };

  const handleTranslate = () => {
    if (!sourceText.trim()) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runTranslation(sourceText, false);
  };

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.record();
      setRecordingState("recording");
      clearResult();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;
    setRecordingState("processing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;

      if (!uri) throw new Error("No recording URI");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      // Phase 1: transcribe — show the spoken words as soon as they're ready,
      // then Phase 2: translate (the result card shows "..." while pending).
      transcribeMutation.mutate(
        {
          data: {
            audioBase64: base64,
            mimeType: "audio/m4a",
          },
        },
        {
          onSuccess: (data) => {
            setSourceText(data.transcription);
            setRecordingState("idle");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            runTranslation(data.transcription, true);
          },
          onError: () => {
            setRecordingState("idle");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
        }
      );
    } catch {
      setRecordingState("idle");
    }
  };

  const handleMicPress = () => {
    // Block new recordings until the full transcribe + translate cycle ends,
    // so an older in-flight request can't race a newer one.
    if (recordingState === "processing" || translateMutation.isPending) return;
    if (recordingState === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCopy = async () => {
    if (translatedText) {
      await Clipboard.setStringAsync(translatedText);
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const swapLanguages = () => {
    if (sourceLanguage !== "auto") {
      const prev = sourceLanguage;
      setSourceLanguage(targetLanguage);
      setTargetLanguage(prev);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const isLoading =
    translateMutation.isPending ||
    transcribeMutation.isPending ||
    recordingState === "processing";
  const hasError = translateMutation.isError || transcribeMutation.isError;
  const errorMessage =
    (transcribeMutation.error as Error | undefined)?.message ||
    (translateMutation.error as Error | undefined)?.message ||
    "Translation failed. Please try again.";

  const displaySourceLang =
    sourceLanguage === "auto"
      ? detectedLang
        ? detectedLang
        : "Auto-detect"
      : sourceLanguage;

  const topPadding = Platform.OS === "web" ? 67 : insets.top + 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPadding, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.wordmark, { color: colors.primary }]}>LingoSwap</Text>
      </View>

      {/* Language selectors */}
      <View
        style={[
          styles.langBar,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.langChip,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => setIsSourceSelectorOpen(true)}
        >
          <Text
            style={[styles.langChipText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {displaySourceLang}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={swapLanguages}
          disabled={sourceLanguage === "auto"}
          style={styles.swapBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather
            name="repeat"
            size={18}
            color={
              sourceLanguage === "auto" ? colors.border : colors.accent
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.langChip,
            {
              backgroundColor: colors.accent,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setIsTargetSelectorOpen(true)}
        >
          <Text
            style={[styles.langChipText, { color: colors.accentForeground }]}
            numberOfLines={1}
          >
            {targetLanguage}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.accentForeground} />
        </TouchableOpacity>
      </View>

      {/* Mode toggle */}
      <View style={[styles.modeRow, { backgroundColor: colors.background }]}>
        <View style={[styles.modePill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.modeOption,
              mode === "voice" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setMode("voice")}
          >
            <Feather
              name="mic"
              size={16}
              color={mode === "voice" ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.modeText,
                {
                  color:
                    mode === "voice" ? colors.primaryForeground : colors.mutedForeground,
                },
              ]}
            >
              Voice
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeOption,
              mode === "text" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setMode("text")}
          >
            <Feather
              name="edit-2"
              size={16}
              color={mode === "text" ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.modeText,
                {
                  color:
                    mode === "text" ? colors.primaryForeground : colors.mutedForeground,
                },
              ]}
            >
              Type
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 104 : insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Voice mode */}
        {mode === "voice" && (
          <View style={styles.voiceArea}>
            <TouchableOpacity
              onPress={handleMicPress}
              disabled={recordingState === "processing" || translateMutation.isPending}
              activeOpacity={0.85}
            >
              <View style={styles.micContainer}>
                {/* Ripple rings */}
                <Animated.View
                  style={[
                    styles.rippleRing,
                    { backgroundColor: colors.accent + "30" },
                    ripple2Style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.rippleRing,
                    { backgroundColor: colors.accent + "40" },
                    ripple1Style,
                  ]}
                />
                {/* Mic button */}
                <Animated.View
                  style={[
                    styles.micButton,
                    {
                      backgroundColor:
                        recordingState === "recording"
                          ? colors.accent
                          : colors.primary,
                    },
                    micScaleStyle,
                  ]}
                >
                  {recordingState === "processing" ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <Feather
                      name={recordingState === "recording" ? "square" : "mic"}
                      size={38}
                      color="#fff"
                    />
                  )}
                </Animated.View>
              </View>
            </TouchableOpacity>

            <Text style={[styles.micHint, { color: colors.mutedForeground }]}>
              {recordingState === "recording"
                ? "Listening... tap to stop"
                : recordingState === "processing"
                ? "Transcribing..."
                : translateMutation.isPending
                ? "Translating..."
                : "Tap to speak"}
            </Text>

            {recordingState === "idle" && !translatedText && (
              <Text style={[styles.micSubhint, { color: colors.border }]}>
                Speak in any language
              </Text>
            )}
          </View>
        )}

        {/* Text mode */}
        {mode === "text" && (
          <View
            style={[
              styles.inputCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Type text to translate..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={sourceText}
              onChangeText={setSourceText}
              maxLength={5000}
              autoCorrect={false}
            />
            <View
              style={[
                styles.inputFooter,
                { borderTopColor: colors.border },
              ]}
            >
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                {sourceText.length}/5000
              </Text>
              <TouchableOpacity
                style={[
                  styles.translateBtn,
                  { backgroundColor: colors.accent },
                  (!sourceText.trim() || isLoading) && { opacity: 0.45 },
                ]}
                onPress={handleTranslate}
                disabled={!sourceText.trim() || isLoading}
              >
                {translateMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.translateBtnText}>Translate</Text>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error state */}
        {hasError && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.destructive + "12",
                borderColor: colors.destructive + "60",
              },
            ]}
          >
            <Feather name="alert-circle" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Result card — also shown while the translation is pending so the
            transcription appears first, with a "..." translating indicator */}
        {translatedText || (sourceText && translateMutation.isPending) ? (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Result header */}
            <View style={styles.resultHeaderRow}>
              <View style={styles.resultLangPair}>
                <Text style={[styles.resultLangFrom, { color: colors.mutedForeground }]}>
                  {detectedLang || displaySourceLang}
                </Text>
                <Feather name="arrow-right" size={12} color={colors.accent} />
                <Text style={[styles.resultLangTo, { color: colors.accent }]}>
                  {targetLanguage}
                </Text>
              </View>
              <View style={styles.resultActions}>
                <TouchableOpacity
                  onPress={clearResult}
                  style={styles.resultActionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCopy}
                  style={styles.resultActionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name={copied ? "check" : "copy"}
                    size={18}
                    color={copied ? colors.accent : colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Source text */}
            {sourceText ? (
              <View style={styles.resultTextRow}>
                <Text
                  style={[
                    styles.resultSourceText,
                    { color: colors.mutedForeground, flex: 1 },
                  ]}
                  numberOfLines={3}
                >
                  {sourceText}
                </Text>
                <SpeakerButton
                  text={sourceText}
                  language={detectedLang || (sourceLanguage !== "auto" ? sourceLanguage : undefined)}
                />
              </View>
            ) : null}

            {/* Divider */}
            <View style={[styles.resultDivider, { backgroundColor: colors.border }]} />

            {/* Translation */}
            {translatedText ? (
              <View style={styles.resultTextRow}>
                <Text
                  style={[
                    styles.resultTranslation,
                    { color: colors.foreground, flex: 1 },
                  ]}
                >
                  {translatedText}
                </Text>
                <SpeakerButton text={translatedText} language={targetLanguage} size={20} />
              </View>
            ) : (
              <View style={styles.resultTextRow}>
                <Text
                  style={[styles.resultTranslation, { color: colors.mutedForeground }]}
                >
                  ...
                </Text>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <LanguageSelector
        visible={isSourceSelectorOpen}
        onClose={() => setIsSourceSelectorOpen(false)}
        onSelect={setSourceLanguage}
        languages={["auto", ...LANGUAGES]}
        selected={sourceLanguage}
        title="Translate from"
      />

      <LanguageSelector
        visible={isTargetSelectorOpen}
        onClose={() => setIsTargetSelectorOpen(false)}
        onSelect={(lang) => {
          userChangedTargetRef.current = true;
          setTargetLanguage(lang);
        }}
        languages={LANGUAGES}
        selected={targetLanguage}
        title="Translate to"
      />
    </View>
  );
}

const MIC_SIZE = 88;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
    borderBottomWidth: 3,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  langBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  langChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 3,
    gap: 6,
  },
  langChipText: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
    fontFamily: "Inter_500Medium",
  },
  swapBtn: {
    padding: 4,
  },
  modeRow: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modePill: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 3,
    padding: 4,
  },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 9,
  },
  modeText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  // Voice
  voiceArea: {
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 12,
    gap: 20,
  },
  micContainer: {
    width: MIC_SIZE * 2.4,
    height: MIC_SIZE * 2.4,
    alignItems: "center",
    justifyContent: "center",
  },
  rippleRing: {
    position: "absolute",
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
  },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  micHint: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  micSubhint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  // Text input
  inputCard: {
    borderRadius: 16,
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  input: {
    padding: 16,
    fontSize: 18,
    textAlignVertical: "top",
    minHeight: 130,
    fontFamily: "Inter_400Regular",
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 3,
  },
  charCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  translateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: "#000",
    minWidth: 110,
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  translateBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    includeFontPadding: false,
  },
  // Error
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
  // Result
  resultCard: {
    borderRadius: 20,
    borderWidth: 3,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    gap: 12,
  },
  resultHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultLangPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultLangFrom: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  resultLangTo: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  resultActions: {
    flexDirection: "row",
    gap: 4,
  },
  resultActionBtn: {
    padding: 6,
  },
  resultTextRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  resultSourceText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  resultDivider: {
    height: 1,
  },
  resultTranslation: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
});
