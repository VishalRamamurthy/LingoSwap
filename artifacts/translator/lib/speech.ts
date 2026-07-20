/**
 * Shared TTS helper built on expo-speech (on-device iOS synthesizer).
 *
 * Handles:
 *  - language-name → BCP-47 code mapping so iOS picks the right voice
 *  - the iOS audio-session gotcha: `allowsRecordingIOS` must be OFF and
 *    `playsInSilentModeIOS` ON before playback, or speech is silent /
 *    routes to the earpiece
 *  - graceful no-op fallback if expo-speech is unavailable
 */

import { Audio } from "expo-av";
import * as Speech from "expo-speech";

const LANGUAGE_TO_BCP47: Record<string, string> = {
  arabic: "ar-SA",
  bengali: "bn-IN",
  bulgarian: "bg-BG",
  chinese: "zh-CN",
  croatian: "hr-HR",
  czech: "cs-CZ",
  danish: "da-DK",
  dutch: "nl-NL",
  english: "en-US",
  estonian: "et-EE",
  finnish: "fi-FI",
  french: "fr-FR",
  german: "de-DE",
  greek: "el-GR",
  hebrew: "he-IL",
  hindi: "hi-IN",
  hungarian: "hu-HU",
  indonesian: "id-ID",
  italian: "it-IT",
  japanese: "ja-JP",
  korean: "ko-KR",
  latvian: "lv-LV",
  lithuanian: "lt-LT",
  norwegian: "nb-NO",
  polish: "pl-PL",
  portuguese: "pt-PT",
  romanian: "ro-RO",
  russian: "ru-RU",
  serbian: "sr-RS",
  slovak: "sk-SK",
  slovenian: "sl-SI",
  spanish: "es-ES",
  swedish: "sv-SE",
  thai: "th-TH",
  turkish: "tr-TR",
  ukrainian: "uk-UA",
  vietnamese: "vi-VN",
};

export function languageNameToBcp47(name: string): string | undefined {
  return LANGUAGE_TO_BCP47[name.trim().toLowerCase()];
}

/** Whether TTS is usable on this device. Never throws. */
export async function isSpeechAvailable(): Promise<boolean> {
  try {
    // Speech.speak exists everywhere expo-speech loaded; getAvailableVoicesAsync
    // is the cheapest capability probe.
    await Speech.getAvailableVoicesAsync();
    return true;
  } catch {
    return false;
  }
}

/** Stop any in-flight speech. Never throws. */
export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // no-op
  }
}

/**
 * Speak `text` in the given app language (e.g. "French").
 * Resolves when speech finishes (or immediately on fallback/no-op).
 */
export async function speak(text: string, languageName: string): Promise<void> {
  if (!text.trim()) return;
  try {
    // iOS audio-session switch: recording OFF, silent-mode playback ON,
    // otherwise playback is silent or routes to the earpiece.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  } catch {
    // continue — speaking may still work
  }

  const language = languageNameToBcp47(languageName);

  await new Promise<void>((resolve) => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    } catch {
      resolve(); // graceful text-only fallback
    }
  });
}
