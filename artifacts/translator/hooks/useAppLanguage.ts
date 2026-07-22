/**
 * Hook for reading and changing the app display language.
 *
 * Returns:
 *   - `language`: current BCP-47 code (e.g. "en", "fr", "ar")
 *   - `setLanguage(code)`: persists to AsyncStorage + updates i18n immediately
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANG_STORAGE_KEY } from "@/lib/i18n";

export function useAppLanguage() {
  const { i18n } = useTranslation();

  const setLanguage = useCallback(
    async (code: string) => {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, code);
      await i18n.changeLanguage(code);
    },
    [i18n]
  );

  return { language: i18n.language, setLanguage };
}
