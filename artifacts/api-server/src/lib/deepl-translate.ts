/**
 * DeepL Translation API (v2, auth-key based).
 * Free-tier keys end in :fx and use api-free.deepl.com.
 */

const LANGUAGE_CODES: Record<string, string> = {
  arabic: "AR",
  bengali: "BN",
  bulgarian: "BG",
  croatian: "HR",
  hebrew: "HE",
  hindi: "HI",
  serbian: "SR",
  thai: "TH",
  vietnamese: "VI",
  chinese: "ZH",
  czech: "CS",
  danish: "DA",
  dutch: "NL",
  english: "EN",
  estonian: "ET",
  finnish: "FI",
  french: "FR",
  german: "DE",
  greek: "EL",
  hungarian: "HU",
  indonesian: "ID",
  italian: "IT",
  japanese: "JA",
  korean: "KO",
  latvian: "LV",
  lithuanian: "LT",
  norwegian: "NB",
  polish: "PL",
  portuguese: "PT",
  romanian: "RO",
  russian: "RU",
  slovak: "SK",
  slovenian: "SL",
  spanish: "ES",
  swedish: "SV",
  turkish: "TR",
  ukrainian: "UK",
};

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LANGUAGE_CODES).map(([name, code]) => [
    code,
    name.charAt(0).toUpperCase() + name.slice(1),
  ]),
);

export function languageNameToCode(name: string): string | undefined {
  return LANGUAGE_CODES[name.trim().toLowerCase()];
}

export function languageCodeToName(code: string): string {
  const upper = code.toUpperCase().split("-")[0];
  return CODE_TO_NAME[upper] ?? code;
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

function deeplBaseUrl(apiKey: string): string {
  return apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2"
    : "https://api.deepl.com/v2";
}

/**
 * Translate text with DeepL.
 * @param text - text to translate
 * @param targetLanguage - language name, e.g. "Spanish"
 * @param sourceLanguage - optional language name; omit for auto-detection
 */
export async function translateWithDeepL(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
): Promise<TranslationResult> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new TranslationConfigError(
      "Translation isn't set up yet: the DeepL API key is missing. Add the DEEPL_API_KEY secret to fix this.",
    );
  }

  const targetCode = languageNameToCode(targetLanguage);
  if (!targetCode) {
    throw new TranslationApiError(`Unsupported target language: ${targetLanguage}`, 400);
  }
  const sourceCode = sourceLanguage ? languageNameToCode(sourceLanguage) : undefined;
  if (sourceLanguage && !sourceCode) {
    throw new TranslationApiError(
      `Unsupported source language: ${sourceLanguage}`,
      400,
    );
  }

  const body: Record<string, unknown> = {
    text: [text],
    target_lang: targetCode,
  };
  if (sourceCode) body.source_lang = sourceCode;

  const response = await fetch(`${deeplBaseUrl(apiKey)}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 403) {
    throw new TranslationConfigError(
      "The DeepL API key appears to be invalid or unauthorized. Double-check the DEEPL_API_KEY secret.",
    );
  }
  if (response.status === 456) {
    throw new TranslationConfigError(
      "Your DeepL account has run out of translation quota for this month.",
    );
  }
  if (!response.ok) {
    throw new TranslationApiError(
      `DeepL translation request failed with status ${response.status}`,
      response.status,
    );
  }

  const json = (await response.json()) as {
    translations?: Array<{
      text?: string;
      detected_source_language?: string;
    }>;
  };

  const translation = json.translations?.[0];
  if (!translation?.text) {
    throw new TranslationApiError("DeepL returned no translation", 502);
  }

  const detectedLanguage = sourceLanguage
    ? sourceLanguage
    : translation.detected_source_language
      ? languageCodeToName(translation.detected_source_language)
      : "Unknown";

  return {
    translatedText: translation.text,
    detectedLanguage,
  };
}
