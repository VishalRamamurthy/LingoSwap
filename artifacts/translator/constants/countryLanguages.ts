/**
 * Maps ISO 3166-1 alpha-2 country codes to the country's primary language,
 * limited to languages the app supports (see constants/languages.ts).
 */
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // Arabic
  AE: "Arabic", BH: "Arabic", DZ: "Arabic", EG: "Arabic", IQ: "Arabic",
  JO: "Arabic", KW: "Arabic", LB: "Arabic", LY: "Arabic", MA: "Arabic",
  OM: "Arabic", QA: "Arabic", SA: "Arabic", SD: "Arabic", SY: "Arabic",
  TN: "Arabic", YE: "Arabic",
  // Bengali
  BD: "Bengali",
  // Bulgarian
  BG: "Bulgarian",
  // Chinese
  CN: "Chinese", HK: "Chinese", MO: "Chinese", SG: "Chinese", TW: "Chinese",
  // Croatian
  HR: "Croatian",
  // Czech
  CZ: "Czech",
  // Danish
  DK: "Danish",
  // Dutch
  BE: "Dutch", NL: "Dutch",
  // English
  AU: "English", CA: "English", GB: "English", IE: "English", KE: "English",
  NG: "English", NZ: "English", PH: "English", US: "English", ZA: "English",
  // Estonian
  EE: "Estonian",
  // Finnish
  FI: "Finnish",
  // French
  BF: "French", BJ: "French", CD: "French", CI: "French", CM: "French",
  FR: "French", GA: "French", GN: "French", LU: "French", MC: "French",
  ML: "French", NE: "French", SN: "French", TG: "French",
  // German
  AT: "German", CH: "German", DE: "German", LI: "German",
  // Greek
  CY: "Greek", GR: "Greek",
  // Hebrew
  IL: "Hebrew",
  // Hindi
  IN: "Hindi",
  // Hungarian
  HU: "Hungarian",
  // Indonesian
  ID: "Indonesian",
  // Italian
  IT: "Italian", SM: "Italian", VA: "Italian",
  // Japanese
  JP: "Japanese",
  // Korean
  KP: "Korean", KR: "Korean",
  // Latvian
  LV: "Latvian",
  // Lithuanian
  LT: "Lithuanian",
  // Norwegian
  NO: "Norwegian",
  // Polish
  PL: "Polish",
  // Portuguese
  AO: "Portuguese", BR: "Portuguese", CV: "Portuguese", MZ: "Portuguese",
  PT: "Portuguese",
  // Romanian
  MD: "Romanian", RO: "Romanian",
  // Russian
  BY: "Russian", KG: "Russian", KZ: "Russian", RU: "Russian",
  // Serbian
  ME: "Serbian", RS: "Serbian",
  // Slovak
  SK: "Slovak",
  // Slovenian
  SI: "Slovenian",
  // Spanish
  AR: "Spanish", BO: "Spanish", CL: "Spanish", CO: "Spanish", CR: "Spanish",
  CU: "Spanish", DO: "Spanish", EC: "Spanish", ES: "Spanish", GT: "Spanish",
  HN: "Spanish", MX: "Spanish", NI: "Spanish", PA: "Spanish", PE: "Spanish",
  PR: "Spanish", PY: "Spanish", SV: "Spanish", UY: "Spanish", VE: "Spanish",
  // Swedish
  SE: "Swedish",
  // Thai
  TH: "Thai",
  // Turkish
  TR: "Turkish",
  // Ukrainian
  UA: "Ukrainian",
  // Vietnamese
  VN: "Vietnamese",
};
