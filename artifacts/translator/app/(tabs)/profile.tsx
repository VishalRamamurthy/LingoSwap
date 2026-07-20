import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth, ApiError } from "@/contexts/AuthContext";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, updateProfile, logout } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);

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
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          You're not signed in.
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={styles.actionBtnText}>Sign in</Text>
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
    if (!name.trim()) { setError("Name cannot be blank."); return; }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim() || undefined });
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <Text style={[styles.logoutLink, { color: colors.accent }]}>Sign out</Text>
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
            <Text style={[styles.displayName, { color: colors.foreground }]}>{user.name}</Text>
            <Text style={[styles.memberSince, { color: colors.mutedForeground }]}>
              Member since {memberSince}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Stat label="Translations" value={profile.translationCount} colors={colors} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Stat label="Voice" value={profile.voiceTranslationCount} colors={colors} />
        </View>

        {/* Info card */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Account info</Text>
            {!editing && (
              <TouchableOpacity onPress={startEdit} activeOpacity={0.7}>
                <Text style={[styles.editLink, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {error && (
            <View style={[styles.errorBanner, { borderColor: colors.accent }]}>
              <Text style={[styles.errorText, { color: colors.accent }]}>{error}</Text>
            </View>
          )}

          {editing ? (
            <>
              <InfoField label="Name" colors={colors}>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!saving}
                />
              </InfoField>
              <InfoField label="Bio" colors={colors}>
                <TextInput
                  style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  placeholder="Tell us about yourself…"
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
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1, opacity: saving ? 0.6 : 1 }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#FFF" size="small" /> : (
                    <Text style={styles.actionBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <InfoRow label="Email" value={user.email} colors={colors} />
              <InfoRow label="Name" value={user.name} colors={colors} />
              <InfoRow label="Bio" value={profile.bio || "—"} colors={colors} />
              {profile.preferredTargetLanguage && (
                <InfoRow label="Default target" value={profile.preferredTargetLanguage} colors={colors} />
              )}
            </>
          )}
        </View>
      </ScrollView>
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

function InfoRow({ label, value, colors }: {
  label: string; value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
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
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)", flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  infoValue: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1, textAlign: "right", marginLeft: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 15 },
  multiline: { height: 80, textAlignVertical: "top" },
  editActions: { flexDirection: "row", marginTop: 8 },
  actionBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15 },
});
