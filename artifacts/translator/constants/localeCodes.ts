/** Maps the app's LANGUAGES array entries to their BCP-47 language codes. */
export const LANGUAGE_TO_CODE: Record<string, string> = {
  Arabic: "ar",
  Bengali: "bn",
  Bulgarian: "bg",
  Chinese: "zh",
  Croatian: "hr",
  Czech: "cs",
  Danish: "da",
  Dutch: "nl",
  English: "en",
  Estonian: "et",
  Finnish: "fi",
  French: "fr",
  German: "de",
  Greek: "el",
  Hebrew: "he",
  Hindi: "hi",
  Hungarian: "hu",
  Indonesian: "id",
  Italian: "it",
  Japanese: "ja",
  Korean: "ko",
  Latvian: "lv",
  Lithuanian: "lt",
  Norwegian: "no",
  Polish: "pl",
  Portuguese: "pt",
  Romanian: "ro",
  Russian: "ru",
  Serbian: "sr",
  Slovak: "sk",
  Slovenian: "sl",
  Spanish: "es",
  Swedish: "sv",
  Thai: "th",
  Turkish: "tr",
  Ukrainian: "uk",
  Vietnamese: "vi",
};

/** The same mapping reversed: code → English name. */
export const CODE_TO_LANGUAGE: Record<string, string> = Object.fromEntries(
  Object.entries(LANGUAGE_TO_CODE).map(([name, code]) => [code, name])
);

/** Language name in its own script, shown in the UI language picker. */
export const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  Arabic: "العربية",
  Bengali: "বাংলা",
  Bulgarian: "Български",
  Chinese: "中文",
  Croatian: "Hrvatski",
  Czech: "Čeština",
  Danish: "Dansk",
  Dutch: "Nederlands",
  English: "English",
  Estonian: "Eesti",
  Finnish: "Suomi",
  French: "Français",
  German: "Deutsch",
  Greek: "Ελληνικά",
  Hebrew: "עברית",
  Hindi: "हिन्दी",
  Hungarian: "Magyar",
  Indonesian: "Bahasa Indonesia",
  Italian: "Italiano",
  Japanese: "日本語",
  Korean: "한국어",
  Latvian: "Latviešu",
  Lithuanian: "Lietuvių",
  Norwegian: "Norsk",
  Polish: "Polski",
  Portuguese: "Português",
  Romanian: "Română",
  Russian: "Русский",
  Serbian: "Српски",
  Slovak: "Slovenčina",
  Slovenian: "Slovenščina",
  Spanish: "Español",
  Swedish: "Svenska",
  Thai: "ภาษาไทย",
  Turkish: "Türkçe",
  Ukrainian: "Українська",
  Vietnamese: "Tiếng Việt",
};

/** RTL languages — text direction must flip for these codes. */
export const RTL_CODES = new Set(["ar", "he"]);

/** All locale codes supported by the i18n system. */
export const SUPPORTED_LOCALE_CODES = Object.values(LANGUAGE_TO_CODE);
