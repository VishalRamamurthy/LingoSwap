import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth, ApiError } from "@/contexts/AuthContext";
import { useAppLanguage } from "@/hooks/useAppLanguage";
import { LANGUAGES } from "@/constants/languages";
import {
  LANGUAGE_TO_CODE,
  NATIVE_LANGUAGE_NAMES,
  RTL_CODES,
} from "@/constants/localeCodes";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { state, updateProfile, logout } = useAuth();
  const { language, setLanguage } = useAppLanguage();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [langModalVisible, setLangModalVisible] = useState(false);

  // RTL-aware text style helper
  const isRTL = RTL_CODES.has(i18n.language);
  const rtlText = isRTL
    ? ({ textAlign: "right" as const, writingDirection: "rtl" as const })
    : {};

  if (state.status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }, rtlText]}>
          {t("profile.notSignedIn")}
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={styles.actionBtnText}>{t("profile.signIn", { defaultValue: "Sign in" })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { user, profile } = state;

  const startEdit = () => {
    setName(user.name);
    setBio(profile.bio ?? "");
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    if (!name.trim()) { setError(t("profile.nameBlank")); return; }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim() || undefined });
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t("profile.signOut"), t("profile.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOut"),
        style: "destructive",
        onPress: async () => { await logout(); router.replace("/(auth)/login"); },
      },
    ]);
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString(i18n.language, {
    month: "long",
    year: "numeric",
  });

  // Derive the current display language name (in native script)
  const currentLangName = LANGUAGES.find(
    (l) => LANGUAGE_TO_CODE[l] === language
  ) ?? "English";
  const currentNativeName = NATIVE_LANGUAGE_NAMES[currentLangName] ?? currentLangName;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }, rtlText]}>
          {t("profile.title")}
        </Text>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <Text style={[styles.logoutLink, { color: colors.accent }]}>
            {t("profile.signOut")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar / initials */}
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>
              {user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.displayName, { color: colors.foreground }, rtlText]}>
              {user.name}
            </Text>
            <Text style={[styles.memberSince, { color: colors.mutedForeground }, rtlText]}>
              {t("profile.memberSince")} {memberSince}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Stat label={t("profile.translations")} value={profile.translationCount} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Stat label={t("profile.voice")} value={profile.voiceTranslationCount} colors={colors} />
        </View>

        {/* Info card */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }, rtlText]}>
              {t("profile.accountInfo")}
            </Text>
            {!editing && (
              <TouchableOpacity onPress={startEdit} activeOpacity={0.7}>
                <Text style={[styles.editLink, { color: colors.accent }]}>{t("common.edit")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {error && (
            <View style={[styles.errorBanner, { borderColor: colors.accent }]}>
              <Text style={[styles.errorText, { color: colors.accent }, rtlText]}>{error}</Text>
            </View>
          )}

          {editing ? (
            <>
              <InfoField label={t("profile.name")} colors={colors}>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!saving}
                />
              </InfoField>
              <InfoField label={t("profile.bio")} colors={colors}>
                <TextInput
                  style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  placeholder={t("profile.bioPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  editable={!saving}
                />
              </InfoField>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.secondary, flex: 1, marginRight: 8 }]}
                  onPress={cancelEdit}
                  disabled={saving}
                >
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1, opacity: saving ? 0.6 : 1 }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#FFF" size="small" /> : (
                    <Text style={styles.actionBtnText}>{t("common.save")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <InfoRow label={t("profile.email")} value={user.email} colors={colors} rtlText={rtlText} />
              <InfoRow label={t("profile.name")} value={user.name} colors={colors} rtlText={rtlText} />
              <InfoRow label={t("profile.bio")} value={profile.bio || "—"} colors={colors} rtlText={rtlText} />
              {profile.preferredTargetLanguage && (
                <InfoRow label={t("profile.defaultTarget")} value={profile.preferredTargetLanguage} colors={colors} rtlText={rtlText} />
              )}
              {/* Display language selector row */}
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => setLangModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }, rtlText]}>
                  {t("profile.displayLanguage")}
                </Text>
                <View style={styles.langRowRight}>
                  <Text style={[styles.infoValue, { color: colors.accent }, rtlText]}>
                    {currentNativeName}
                  </Text>
                  <Feather name="chevron-right" size={14} color={colors.accent} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Language picker modal */}
      <Modal
        visible={langModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t("profile.displayLanguage")}
            </Text>
            <TouchableOpacity
              onPress={() => setLangModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const code = LANGUAGE_TO_CODE[item];
              const isSelected = code === language;
              const nativeName = NATIVE_LANGUAGE_NAMES[item] ?? item;
              return (
                <TouchableOpacity
                  style={[
                    styles.langItem,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.accent + "10" },
                  ]}
                  onPress={async () => {
                    await setLanguage(code);
                    setLangModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.langItemInner}>
                    <Text style={[styles.langNative, { color: colors.foreground }]}>
                      {nativeName}
                    </Text>
                    <Text style={[styles.langEnglish, { color: colors.mutedForeground }]}>
                      {item}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={18} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, colors }: {
  label: string; value: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, colors, rtlText }: {
  label: string; value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  rtlText?: object;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }, rtlText]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }, rtlText]}>{value}</Text>
    </View>
  );
}

function InfoField({ label, children, colors }: {
  label: string; children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 16 },
  headerBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 3,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -0.5 },
  logoutLink: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 100 },
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
    marginRight: 16,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#FFFFFF" },
  avatarInfo: { flex: 1 },
  displayName: { fontFamily: "Inter_700Bold", fontSize: 20 },
  memberSince: { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 2 },
  statsCard: {
    flexDirection: "row", borderWidth: 3, borderRadius: 12, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 28 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  statDivider: { width: 3 },
  card: {
    borderWidth: 3, borderRadius: 12, padding: 20, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 16, textTransform: "uppercase", letterSpacing: 0.5 },
  editLink: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  errorBanner: { borderWidth: 2, borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  infoRow: {
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  infoLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  infoValue: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1, textAlign: "right", marginLeft: 12 },
  langRowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  field: { marginBottom: 12 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 15 },
  multiline: { height: 80, textAlignVertical: "top" },
  editActions: { flexDirection: "row", marginTop: 8 },
  actionBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15 },
  // Language picker modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  langItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langItemInner: { flex: 1 },
  langNative: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  langEnglish: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
});
