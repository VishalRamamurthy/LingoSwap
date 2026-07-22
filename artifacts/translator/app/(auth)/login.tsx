import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useAuth, ApiError } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(t("errors.missingCredentials"));
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>LingoSwap</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t("auth.signInTitle")}
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Error banner */}
          {error && (
            <View style={[styles.errorBanner, { borderColor: colors.accent }]}>
              <Text style={[styles.errorBannerText, { color: colors.accent }]}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("auth.email")}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("auth.password")}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
          </View>

          {/* Remember me */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setRememberMe((v) => !v)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.border, backgroundColor: rememberMe ? colors.accent : "transparent" },
              ]}
            >
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: colors.mutedForeground }]}>{t("auth.rememberMe")}</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent, opacity: loading ? 0.6 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t("auth.signIn")}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {t("auth.noAccount")}{" "}
          </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={[styles.footerLink, { color: colors.accent }]}>{t("auth.createOne")}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
    header: { alignItems: "center", marginBottom: 32 },
    wordmark: { fontFamily: "Inter_700Bold", fontSize: 32, letterSpacing: -1 },
    subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, marginTop: 6 },
    card: {
      borderWidth: 3, borderRadius: colors.radius, padding: 24,
      shadowColor: "#000", shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5,
    },
    errorBanner: { borderWidth: 2, borderRadius: 8, padding: 12, marginBottom: 16 },
    errorBannerText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    field: { marginBottom: 16 },
    label: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
    input: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 16 },
    checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
    checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 4, marginRight: 10, alignItems: "center", justifyContent: "center" },
    checkmark: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
    checkLabel: { fontFamily: "Inter_400Regular", fontSize: 15 },
    button: { borderRadius: 8, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
    buttonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: 0.3 },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
    footerText: { fontFamily: "Inter_400Regular", fontSize: 15 },
    footerLink: { fontFamily: "Inter_700Bold", fontSize: 15 },
  });
}
