import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Platform, Keyboard, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTranslateText } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useHistory } from "@/contexts/HistoryContext";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LANGUAGES } from "@/constants/languages";
import LanguageSelector from "@/components/LanguageSelector";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function TranslateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sourceText, setSourceText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const { addEntry } = useHistory();
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState(false);
  const [isTargetSelectorOpen, setIsTargetSelectorOpen] = useState(false);

  const translateMutation = useTranslateText();
  const params = useLocalSearchParams<{
    restoreText?: string;
    restoreSourceLang?: string;
    restoreTargetLang?: string;
    restoreTranslatedText?: string;
  }>();
  const router = useRouter();

  useEffect(() => {
    if (params.restoreText) {
      setSourceText(params.restoreText);
      setSourceLanguage(params.restoreSourceLang || "auto");
      setTargetLanguage(params.restoreTargetLang || "Spanish");
      setTranslatedText(params.restoreTranslatedText || "");
      setDetectedLang("");
      // Clear params so it doesn't repeatedly restore if navigated to without params
      router.setParams({
        restoreText: "",
        restoreSourceLang: "",
        restoreTargetLang: "",
        restoreTranslatedText: "",
      });
    }
  }, [params, router]);

  const handleTranslate = () => {
    if (!sourceText.trim()) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    translateMutation.mutate({
      data: {
        text: sourceText,
        sourceLanguage: sourceLanguage === "auto" ? undefined : sourceLanguage,
        targetLanguage,
      }
    }, {
      onSuccess: (data) => {
        setTranslatedText(data.translatedText);
        setDetectedLang(data.detectedLanguage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addEntry({
          sourceText,
          translatedText: data.translatedText,
          sourceLanguage: sourceLanguage === "auto" ? data.detectedLanguage : sourceLanguage,
          targetLanguage,
        });
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    });
  };

  const handleCopy = async () => {
    if (translatedText) {
      await Clipboard.setStringAsync(translatedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const swapLanguages = () => {
    if (sourceLanguage !== "auto") {
      setSourceLanguage(targetLanguage);
      setTargetLanguage(sourceLanguage);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20, backgroundColor: colors.background, zIndex: 10 }]}>
        <View style={styles.languageSelectors}>
          <TouchableOpacity 
            style={[styles.langButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIsSourceSelectorOpen(true)}
          >
            <Text style={[styles.langText, { color: colors.foreground }]} numberOfLines={1}>
              {sourceLanguage === "auto" ? "Detect Language" : sourceLanguage}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={swapLanguages} style={styles.swapButton} disabled={sourceLanguage === "auto"}>
            <Feather name="refresh-cw" size={20} color={sourceLanguage === "auto" ? colors.mutedForeground : colors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.langButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIsTargetSelectorOpen(true)}
          >
            <Text style={[styles.langText, { color: colors.foreground }]} numberOfLines={1}>
              {targetLanguage}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollViewCompat style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Enter text to translate..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            value={sourceText}
            onChangeText={setSourceText}
            maxLength={5000}
          />
          <View style={styles.inputFooter}>
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{sourceText.length}/5000</Text>
            <TouchableOpacity 
              style={[styles.translateButton, { backgroundColor: colors.primary }, (!sourceText.trim() || translateMutation.isPending) && { opacity: 0.5 }]}
              onPress={handleTranslate}
              disabled={!sourceText.trim() || translateMutation.isPending}
            >
              {translateMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <>
                  <Text style={[styles.translateButtonText, { color: colors.primaryForeground }]}>Translate</Text>
                  <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {translateMutation.isError && (
          <View style={[styles.errorCard, { backgroundColor: colors.destructive + '10', borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={20} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>Failed to translate. Please try again.</Text>
          </View>
        )}

        {translatedText ? (
          <View style={[styles.resultCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.detectedText, { color: colors.primary }]}>
                {sourceLanguage === "auto" && detectedLang ? `Detected: ${detectedLang}` : targetLanguage}
              </Text>
              <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
                <Feather name="copy" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.resultText, { color: colors.foreground }]}>{translatedText}</Text>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

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
        onSelect={setTargetLanguage} 
        languages={LANGUAGES} 
        selected={targetLanguage} 
        title="Translate to"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  languageSelectors: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  langText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  swapButton: {
    padding: 12,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 200,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 20,
    textAlignVertical: "top",
    minHeight: 140,
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  charCount: {
    fontSize: 14,
  },
  translateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  translateButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "500",
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    minHeight: 150,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detectedText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  copyButton: {
    padding: 4,
  },
  resultText: {
    fontSize: 24,
    lineHeight: 32,
  },
});
