import React from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, Platform } from "react-native";
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
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to clear all history?')) {
        clearHistory();
      }
    } else {
      Alert.alert(
        "Clear History",
        "Are you sure you want to clear all translation history?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Clear", style: "destructive", onPress: clearHistory }
        ]
      );
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
      }
    });
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <TouchableOpacity 
      style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleRestore(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.langPair}>
          <Text style={[styles.langText, { color: colors.primary }]}>{item.sourceLanguage}</Text>
          <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
          <Text style={[styles.langText, { color: colors.primary }]}>{item.targetLanguage}</Text>
        </View>
        <View style={styles.cardActions}>
          <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
          </Text>
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              deleteEntry(item.id);
            }} 
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.textPair}>
        <Text style={[styles.sourceText, { color: colors.foreground }]} numberOfLines={2}>{item.sourceText}</Text>
        <Text style={[styles.translatedText, { color: colors.foreground }]} numberOfLines={3}>{item.translatedText}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Text style={[styles.clearButtonText, { color: colors.destructive }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
            <Feather name="clock" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No History</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Your recent translations will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  historyCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  langPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langText: {
    fontSize: 14,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeText: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 4,
  },
  textPair: {
    gap: 8,
  },
  sourceText: {
    fontSize: 16,
    opacity: 0.8,
  },
  translatedText: {
    fontSize: 18,
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
});
