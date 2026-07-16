/**
 * Google Cloud Translation (v2 REST API, API-key based).
 * Translates text between languages and detects source language.
 */

const LANGUAGE_CODES: Record<string, string> = {
  arabic: "ar",
  bengali: "bn",
  bulgarian: "bg",
  chinese: "zh",
  croatian: "hr",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  english: "en",
  estonian: "et",
  finnish: "fi",
  french: "fr",
  german: "de",
  greek: "el",
  hebrew: "he",
  hindi: "hi",
  hungarian: "hu",
  indonesian: "id",
  italian: "it",
  japanese: "ja",
  korean: "ko",
  latvian: "lv",
  lithuanian: "lt",
  norwegian: "no",
  polish: "pl",
  portuguese: "pt",
  romanian: "ro",
  russian: "ru",
  serbian: "sr",
  slovak: "sk",
  slovenian: "sl",
  spanish: "es",
  swedish: "sv",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
  vietnamese: "vi",
};

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LANGUAGE_CODES).map(([name, code]) => [
    code,
    name.charAt(0).toUpperCase() + name.slice(1),
  ]),
);
// Google may return regional variants
CODE_TO_NAME["zh-CN"] = "Chinese";
CODE_TO_NAME["zh-TW"] = "Chinese";
CODE_TO_NAME["iw"] = "Hebrew";

export function languageNameToCode(name: string): string | undefined {
  return LANGUAGE_CODES[name.trim().toLowerCase()];
}

export function languageCodeToName(code: string): string {
  return CODE_TO_NAME[code] ?? CODE_TO_NAME[code.split("-")[0]] ?? code;
}

export class TranslationConfigError extends Error {}
export class TranslationApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
}

/**
 * Translate text with Google Cloud Translation.
 * @param text - text to translate
 * @param targetLanguage - language name, e.g. "Spanish"
 * @param sourceLanguage - optional language name; omit for auto-detection
 */
export async function translateWithGoogle(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
): Promise<TranslationResult> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new TranslationConfigError(
      "Translation isn't set up yet: the Google Translation API key is missing. Add the GOOGLE_TRANSLATE_API_KEY secret to fix this.",
    );
  }

  const targetCode = languageNameToCode(targetLanguage);
  if (!targetCode) {
    throw new TranslationApiError(`Unsupported target language: ${targetLanguage}`, 400);
  }
  const sourceCode = sourceLanguage ? languageNameToCode(sourceLanguage) : undefined;

  const params: Record<string, string> = {
    q: text,
    target: targetCode,
    format: "text",
  };
  if (sourceCode) params.source = sourceCode;

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new TranslationConfigError(
      "The Google Translation API key appears to be invalid or not authorized. Double-check the GOOGLE_TRANSLATE_API_KEY secret and that the Cloud Translation API is enabled for it.",
    );
  }
  if (!response.ok) {
    throw new TranslationApiError(
      `Google Translation request failed with status ${response.status}`,
      response.status,
    );
  }

  const json = (await response.json()) as {
    data?: {
      translations?: Array<{
        translatedText?: string;
        detectedSourceLanguage?: string;
      }>;
    };
  };

  const translation = json.data?.translations?.[0];
  if (!translation?.translatedText) {
    throw new TranslationApiError("Google Translation returned no result", 502);
  }

  const detectedLanguage = sourceLanguage
    ? sourceLanguage
    : translation.detectedSourceLanguage
      ? languageCodeToName(translation.detectedSourceLanguage)
      : "Unknown";

  return {
    translatedText: translation.translatedText,
    detectedLanguage,
  };
}
