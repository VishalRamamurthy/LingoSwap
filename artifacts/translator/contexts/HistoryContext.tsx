import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryEntryType = 'text' | 'voice' | 'snapshot' | 'menu' | 'conversation';

type HistoryEntryBase = {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
};

/** Text / voice / snapshot entries (legacy shape — `type` may be absent). */
export type TextHistoryEntry = HistoryEntryBase & {
  /** Discriminator — defaults to 'text' for legacy entries that lack it. */
  type?: 'text' | 'voice' | 'snapshot';
  sourceText: string; // For snapshot: the OCR-detected text
  translatedText: string;
  /** @deprecated Use `type === 'voice'` instead. Kept for backward compat. */
  isVoice?: boolean;
};

export type MenuHistoryItem = {
  id: string;
  originalText: string;
  price: string | null;
  translatedText: string;
  isSectionHeader: boolean;
};

export type MenuHistoryEntry = HistoryEntryBase & {
  type: 'menu';
  items: MenuHistoryItem[];
  imageUri?: string;
};

export type ConversationTurnEntry = {
  side: 'top' | 'bottom';
  original: string;
  translated: string;
};

export type ConversationHistoryEntry = HistoryEntryBase & {
  type: 'conversation';
  turns: ConversationTurnEntry[];
};

export type HistoryEntry = TextHistoryEntry | MenuHistoryEntry | ConversationHistoryEntry;

export type NewHistoryEntry =
  | Omit<TextHistoryEntry, 'id' | 'timestamp'>
  | Omit<MenuHistoryEntry, 'id' | 'timestamp'>
  | Omit<ConversationHistoryEntry, 'id' | 'timestamp'>;

type HistoryContextType = {
  history: HistoryEntry[];
  addEntry: (entry: NewHistoryEntry) => void;
  deleteEntry: (id: string) => void;
  clearHistory: () => void;
};

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem('translation-history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  const saveHistory = async (newHistory: HistoryEntry[]) => {
    try {
      await AsyncStorage.setItem('translation-history', JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (e) {
      console.error('Failed to save history', e);
    }
  };

  const addEntry = (entry: NewHistoryEntry) => {
    const newEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    } as HistoryEntry;
    const newHistory = [newEntry, ...history].slice(0, 100);
    saveHistory(newHistory);
  };

  const deleteEntry = (id: string) => {
    saveHistory(history.filter(entry => entry.id !== id));
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  return (
    <HistoryContext.Provider value={{ history, addEntry, deleteEntry, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
