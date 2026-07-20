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
import { useColors } from "@/hooks/useColors";
import { useAuth, ApiError } from "@/contexts/AuthContext";

type FieldErrors = { name?: string; email?: string; password?: string; confirmPassword?: string };

export default function SignupScreen() {
  const colors = useColors();
  const { signup } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address.";
    if (!password || password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (password !== confirmPassword)
      errs.confirmPassword = "Passwords don't match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async () => {
    setGlobalError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      if (e instanceof ApiError && e.field) {
        setFieldErrors((prev) => ({ ...prev, [e.field!]: e.message }));
      } else {
        setGlobalError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      }
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>LingoSwap</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Create your account
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {globalError && (
            <View style={[styles.errorBanner, { borderColor: colors.accent }]}>
              <Text style={[styles.errorBannerText, { color: colors.accent }]}>{globalError}</Text>
            </View>
          )}

          <Field
            label="Name"
            value={name}
            onChangeText={(v) => { setName(v); setFieldErrors((p) => ({ ...p, name: undefined })); }}
            placeholder="Your name"
            error={fieldErrors.name}
            autoCapitalize="words"
            returnKeyType="next"
            colors={colors}
            editable={!loading}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={(v) => { setEmail(v); setFieldErrors((p) => ({ ...p, email: undefined })); }}
            placeholder="you@example.com"
            error={fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            colors={colors}
            editable={!loading}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: undefined })); }}
            placeholder="At least 8 characters"
            error={fieldErrors.password}
            secureTextEntry
            returnKeyType="next"
            colors={colors}
            editable={!loading}
          />
          <Field
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
            placeholder="Repeat password"
            error={fieldErrors.confirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignup}
            colors={colors}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent, opacity: loading ? 0.6 : 1 }]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={[styles.footerLink, { color: colors.accent }]}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, error, colors, secureTextEntry, keyboardType,
  autoCapitalize, returnKeyType, onSubmitEditing, editable,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "words" | "sentences";
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  editable?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { borderColor: error ? colors.accent : colors.border, color: colors.foreground, backgroundColor: colors.background },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        editable={editable}
      />
      {error && <Text style={[styles.fieldError, { color: colors.accent }]}>{error}</Text>}
    </View>
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
    fieldError: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 },
    button: { borderRadius: 8, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
    buttonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: 0.3 },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
    footerText: { fontFamily: "Inter_400Regular", fontSize: 15 },
    footerLink: { fontFamily: "Inter_700Bold", fontSize: 15 },
  });
}
