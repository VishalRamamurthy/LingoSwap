import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/contexts/HistoryContext";
import { useSnapshotTranslate, type SnapshotResponse } from "@/hooks/useSnapshotTranslate";
import { useTranslateText } from "@workspace/api-client-react";
import LanguageSelector from "@/components/LanguageSelector";
import { LANGUAGES } from "@/constants/languages";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "idle" | "processing" | "result" | "empty" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pickAndResize(
  fromLibrary: boolean,
): Promise<{ uri: string; base64: string } | null> {
  // Permission check
  if (fromLibrary) {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return null;
  } else {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return null;
  }

  const result = fromLibrary
    ? await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      })
    : await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  // Resize so long edge ≤ 1600 px; compress to JPEG 0.7; request base64
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const longEdge = Math.max(w, h);
  const needsResize = longEdge > 1600;
  const resize = needsResize
    ? w >= h
      ? { width: 1600 }
      : { height: 1600 }
    : undefined;

  const manipulated = await manipulateAsync(
    asset.uri,
    resize ? [{ resize }] : [],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true },
  );

  if (!manipulated.base64) return null;
  return { uri: manipulated.uri, base64: manipulated.base64 };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SnapshotScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry } = useHistory();

  const [phase, setPhase] = useState<Phase>("idle");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [detectedText, setDetectedText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>();
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [errorMessage, setErrorMessage] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLangSelectorOpen, setIsLangSelectorOpen] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [originalExpanded, setOriginalExpanded] = useState(false);

  // Track language changes so we can auto-retranslate only on change
  const prevTargetLangRef = useRef(targetLanguage);
  const isFirstResultRef = useRef(true);

  const snapshotMutation = useSnapshotTranslate();
  const retranslateMutation = useTranslateText();

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetToIdle = () => {
    snapshotMutation.reset();
    retranslateMutation.reset();
    setPhase("idle");
    setImageUri(null);
    setImageBase64(null);
    setDetectedText("");
    setTranslatedText("");
    setDetectedLanguage(undefined);
    setErrorMessage("");
    setPermissionDenied(false);
    setSavedToHistory(false);
    setCopiedTranslation(false);
    setOriginalExpanded(false);
    isFirstResultRef.current = true;
    prevTargetLangRef.current = targetLanguage;
  };

  const applyResult = (data: SnapshotResponse) => {
    if (!data.detectedText) {
      setPhase("empty");
      return;
    }
    setDetectedText(data.detectedText);
    setTranslatedText(data.translatedText);
    setDetectedLanguage(data.detectedLanguage);
    isFirstResultRef.current = true; // arm the guard for the first lang change
    prevTargetLangRef.current = targetLanguage;
    setPhase("result");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const runOCR = (base64: string, uri: string, lang: string) => {
    setImageUri(uri);
    setImageBase64(base64);
    setPhase("processing");
    snapshotMutation.reset();

    snapshotMutation.mutate(
      { image: base64, mimeType: "image/jpeg", targetLanguage: lang },
      {
        onSuccess: applyResult,
        onError: (err: Error & { code?: string }) => {
          if (err.code === "ocr_not_configured" || err.code === "ocr_invalid_key") {
            setErrorMessage(
              `${err.message}\n\nThe app admin needs to add a valid OPENAI_API_KEY secret in the Replit Secrets panel.`,
            );
          } else {
            setErrorMessage(err.message || "Something went wrong. Please try again.");
          }
          setPhase("error");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  };

  const handleCapture = async (fromLibrary: boolean) => {
    setPermissionDenied(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const image = await pickAndResize(fromLibrary);

    if (!image) {
      // Distinguish "cancelled" from "denied" by checking the permission state
      const perm = fromLibrary
        ? await ImagePicker.getMediaLibraryPermissionsAsync()
        : await ImagePicker.getCameraPermissionsAsync();
      if (perm.status === "denied") {
        setPermissionDenied(true);
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runOCR(image.base64, image.uri, targetLanguage);
  };

  const handleRetranslate = (newLang: string) => {
    if (!detectedText || phase !== "result") return;
    // If this is the very first language-change trigger after entering result
    // state (fired by the LanguageSelector's onSelect), fire immediately.
    setTargetLanguage(newLang);
    retranslateMutation.mutate(
      {
        data: {
          text: detectedText,
          sourceLanguage: detectedLanguage,
          targetLanguage: newLang,
        },
      },
      {
        onSuccess: (data) => setTranslatedText(data.translatedText),
      },
    );
  };

  const handleRetry = () => {
    if (imageBase64 && imageUri) {
      runOCR(imageBase64, imageUri, targetLanguage);
    }
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
    setCopiedTranslation(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopiedTranslation(false), 2000);
  };

  const handleSaveToHistory = () => {
    if (!detectedText || !translatedText) return;
    addEntry({
      type: "snapshot",
      sourceText: detectedText,
      translatedText,
      sourceLanguage: detectedLanguage || "auto",
      targetLanguage,
    });
    setSavedToHistory(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSavedToHistory(false), 2500);
  };

  // ── Common computed values ─────────────────────────────────────────────────

  const isRetranslating = retranslateMutation.isPending;
  const topPadding = Platform.OS === "web" ? 67 : insets.top + 12;
  const bottomPadding = Platform.OS === "web" ? 104 : insets.bottom + 100;

  // ── Render: language bar (shared across states) ────────────────────────────

  const LangBar = (
    <View style={[styles.langBar, { borderBottomColor: colors.border }]}>
      <Text style={[styles.langBarLabel, { color: colors.mutedForeground }]}>
        Translate to
      </Text>
      <TouchableOpacity
        style={[styles.langChip, { backgroundColor: colors.accent, borderColor: colors.border }]}
        onPress={() => setIsLangSelectorOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.langChipText, { color: colors.accentForeground }]} numberOfLines={1}>
          {targetLanguage}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.accentForeground} />
      </TouchableOpacity>
    </View>
  );

  // ── Render: image preview ──────────────────────────────────────────────────

  const ImagePreview = imageUri ? (
    <Image
      source={{ uri: imageUri }}
      style={styles.imagePreview}
      contentFit="contain"
      transition={200}
    />
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Phases
  // ─────────────────────────────────────────────────────────────────────────

  // IDLE ─────────────────────────────────────────────────────────────────────
  const renderIdle = () => (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Snapshot</Text>
      </View>

      {LangBar}

      {permissionDenied && (
        <View style={[styles.permBanner, { backgroundColor: colors.destructive + "14", borderColor: colors.destructive + "50" }]}>
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <Text style={[styles.permText, { color: colors.destructive }]}>
            Permission denied.{" "}
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={[styles.permLink, { color: colors.destructive }]}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.idleContent}>
        {/* Icon */}
        <View style={[styles.idleIconWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="camera" size={40} color={colors.mutedForeground} />
        </View>

        <Text style={[styles.idleTitle, { color: colors.foreground }]}>
          Translate text in photos
        </Text>
        <Text style={[styles.idleSubtitle, { color: colors.mutedForeground }]}>
          Point your camera at a sign, menu, label, or any text — LingoSwap will read and translate it.
        </Text>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent, borderColor: "#000" }]}
          onPress={() => handleCapture(false)}
          activeOpacity={0.85}
        >
          <Feather name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Take photo</Text>
        </TouchableOpacity>

        {/* Secondary CTA */}
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => handleCapture(true)}
          activeOpacity={0.8}
        >
          <Feather name="image" size={18} color={colors.foreground} />
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Choose from library</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // PROCESSING ───────────────────────────────────────────────────────────────
  const renderProcessing = () => (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.processingScroll, { paddingBottom: bottomPadding }]}
    >
      <View style={[styles.headerBar, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Snapshot</Text>
      </View>

      {ImagePreview}

      <View style={[styles.processingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.processingLabel, { color: colors.foreground }]}>
          Reading text…
        </Text>
        <Text style={[styles.processingHint, { color: colors.mutedForeground }]}>
          Translating to {targetLanguage}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.cancelBtn, { borderColor: colors.border }]}
        onPress={resetToIdle}
        activeOpacity={0.7}
      >
        <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // RESULT ───────────────────────────────────────────────────────────────────
  const renderResult = () => (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Snapshot</Text>
        <TouchableOpacity onPress={resetToIdle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.resultScroll, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image — capped at ~38% screen height */}
        {ImagePreview}

        {/* Language re-selector */}
        <View style={[styles.resultLangRow, { borderColor: colors.border }]}>
          <Text style={[styles.resultLangLabel, { color: colors.mutedForeground }]}>
            {detectedLanguage || "Detected"}
          </Text>
          <Feather name="arrow-right" size={14} color={colors.accent} />
          <TouchableOpacity
            style={[styles.langChip, { backgroundColor: colors.accent, borderColor: colors.border }]}
            onPress={() => setIsLangSelectorOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.langChipText, { color: colors.accentForeground }]} numberOfLines={1}>
              {targetLanguage}
            </Text>
            <Feather name="chevron-down" size={13} color={colors.accentForeground} />
          </TouchableOpacity>
        </View>

        {/* Translation card */}
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Translated text — hero */}
          {isRetranslating ? (
            <View style={styles.retranslatingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.retranslatingText, { color: colors.mutedForeground }]}>
                Translating…
              </Text>
            </View>
          ) : (
            <Text
              style={[styles.translatedHero, { color: colors.foreground }]}
              selectable
            >
              {translatedText}
            </Text>
          )}

          {/* Original text — collapsible */}
          <View style={[styles.originalSection, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.originalToggle}
              onPress={() => setOriginalExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.originalLabel, { color: colors.mutedForeground }]}>
                Original
              </Text>
              <Feather
                name={originalExpanded ? "chevron-up" : "chevron-down"}
                size={15}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {originalExpanded && (
              <Text
                style={[styles.originalText, { color: colors.mutedForeground }]}
                selectable
              >
                {detectedText}
              </Text>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]}
            onPress={handleCopy}
            activeOpacity={0.8}
          >
            <Feather
              name={copiedTranslation ? "check" : "copy"}
              size={16}
              color={copiedTranslation ? colors.accent : colors.foreground}
            />
            <Text style={[styles.actionBtnText, { color: copiedTranslation ? colors.accent : colors.foreground }]}>
              {copiedTranslation ? "Copied" : "Copy"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]}
            onPress={() => handleCapture(false)}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: savedToHistory ? colors.accent : colors.secondary,
                borderColor: colors.border,
                flex: 1,
              },
            ]}
            onPress={handleSaveToHistory}
            disabled={savedToHistory}
            activeOpacity={0.8}
          >
            <Feather
              name={savedToHistory ? "check" : "bookmark"}
              size={16}
              color={savedToHistory ? "#FFFFFF" : colors.foreground}
            />
            <Text style={[styles.actionBtnText, { color: savedToHistory ? "#FFFFFF" : colors.foreground }]}>
              {savedToHistory ? "Saved" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // EMPTY ────────────────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Snapshot</Text>
      </View>

      {ImagePreview}

      <View style={styles.emptyContent}>
        <View style={[styles.idleIconWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="eye-off" size={32} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No text found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Make sure the text is clear and well-lit, then try again.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent, borderColor: "#000" }]}
          onPress={() => handleCapture(false)}
          activeOpacity={0.85}
        >
          <Feather name="camera" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: colors.border, marginTop: 0 }]}
          onPress={resetToIdle}
        >
          <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ERROR ────────────────────────────────────────────────────────────────────
  const renderError = () => (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Snapshot</Text>
      </View>

      {ImagePreview}

      <View style={styles.emptyContent}>
        <View style={[styles.idleIconWrap, { backgroundColor: colors.destructive + "14", borderColor: colors.destructive + "40" }]}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Something went wrong
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          {errorMessage || "Please check your connection and try again."}
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent, borderColor: "#000" }]}
          onPress={handleRetry}
          activeOpacity={0.85}
        >
          <Feather name="refresh-cw" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: colors.border, marginTop: 0 }]}
          onPress={resetToIdle}
        >
          <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Top-level render ─────────────────────────────────────────────────────

  return (
    <>
      {phase === "idle" && renderIdle()}
      {phase === "processing" && renderProcessing()}
      {phase === "result" && renderResult()}
      {phase === "empty" && renderEmpty()}
      {phase === "error" && renderError()}

      <LanguageSelector
        visible={isLangSelectorOpen}
        onClose={() => setIsLangSelectorOpen(false)}
        onSelect={(lang) => {
          if (phase === "result") {
            handleRetranslate(lang);
          } else {
            setTargetLanguage(lang);
          }
        }}
        languages={LANGUAGES}
        selected={targetLanguage}
        title="Translate to"
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Header
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 3,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },

  // Language bar (idle)
  langBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  langBarLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    gap: 5,
  },
  langChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },

  // Permission banner
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  permText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  permLink: { fontFamily: "Inter_700Bold", fontSize: 14, textDecorationLine: "underline" },

  // Idle content
  idleContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  idleIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  idleTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  idleSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    alignSelf: "center",
    marginTop: 8,
  },
  cancelBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },

  // Image preview
  imagePreview: {
    width: "100%",
    height: 260,
    backgroundColor: "#000",
  },

  // Processing
  processingScroll: {
    gap: 16,
  },
  processingCard: {
    marginHorizontal: 16,
    borderWidth: 3,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  processingLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  processingHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },

  // Result
  resultScroll: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultLangRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  resultLangLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flex: 1,
  },
  resultCard: {
    borderWidth: 3,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  translatedHero: {
    fontFamily: "Inter_500Medium",
    fontSize: 22,
    lineHeight: 32,
    padding: 20,
    textAlignVertical: "top",
  },
  retranslatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 20,
    minHeight: 72,
  },
  retranslatingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  originalSection: {
    borderTopWidth: 2,
  },
  originalToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  originalLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  originalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  // Actions row
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },

  // Empty / error
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
});
