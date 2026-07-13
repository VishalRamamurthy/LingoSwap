import React from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { useHistory, HistoryEntry } from "@/contexts/HistoryContext";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history, deleteEntry, clearHistory } = useHistory();
  const router = useRouter();

  const handleClearAll = () => {
    if (Platform.OS === "web") {
      if (confirm("Clear all translation history?")) clearHistory();
    } else {
      Alert.alert("Clear History", "Remove all translation history?", [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: clearHistory },
      ]);
    }
  };

  const handleRestore = (item: HistoryEntry) => {
    router.push({
      pathname: "/",
      params: {
        restoreText: item.sourceText,
        restoreSourceLang: item.sourceLanguage,
        restoreTargetLang: item.targetLanguage,
        restoreTranslatedText: item.translatedText,
      },
    });
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => handleRestore(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={styles.langRow}>
          {item.isVoice && (
            <View
              style={[
                styles.voiceBadge,
                {
                  backgroundColor: colors.accent + "18",
                  borderColor: colors.accent + "40",
                },
              ]}
            >
              <Feather name="mic" size={10} color={colors.accent} />
            </View>
          )}
          <Text style={[styles.langFrom, { color: colors.mutedForeground }]}>
            {item.sourceLanguage}
          </Text>
          <Feather name="arrow-right" size={12} color={colors.border} />
          <Text style={[styles.langTo, { color: colors.accent }]}>
            {item.targetLanguage}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.timeText, { color: colors.border }]}>
            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              deleteEntry(item.id);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="trash-2" size={15} color={colors.border} />
          </TouchableOpacity>
        </View>
      </View>

      <Text
        style={[styles.sourceText, { color: colors.mutedForeground }]}
        numberOfLines={1}
      >
        {item.sourceText}
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text
        style={[styles.translatedText, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {item.translatedText}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={[styles.clearBtn, { color: colors.destructive }]}>
              Clear
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Feather name="clock" size={28} color={colors.border} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No translations yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Your translated phrases will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                Platform.OS === "web" ? 104 : insets.bottom + 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!history.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  clearBtn: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voiceBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  langFrom: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  langTo: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  sourceText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  translatedText: {
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 24,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
});
