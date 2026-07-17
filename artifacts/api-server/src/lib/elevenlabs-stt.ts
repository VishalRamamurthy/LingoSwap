/**
 * ElevenLabs Speech-to-Text using the Scribe v1 model.
 * Single POST, synchronous response — no polling required.
 */

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL_ID = "scribe_v1";

interface ElevenLabsSTTResponse {
  text: string;
  language_code: string;
  language_probability: number;
  transcription_id: string;
  audio_duration_secs: number;
}

function apiKey(): string {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured.");
  return key;
}

/**
 * Transcribe raw audio bytes using ElevenLabs Scribe v1.
 * Accepts any format ElevenLabs supports (m4a, mp3, wav, webm, ogg, mp4…).
 * Returns the transcribed text, or throws on error.
 */
export async function elevenLabsSpeechToText(
  audioBuffer: Buffer,
  mimeType = "audio/m4a",
): Promise<string> {
  const key = apiKey();

  const form = new FormData();
  form.append("model_id", MODEL_ID);
  // language_code omitted — ElevenLabs will auto-detect
  form.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
    "audio.m4a",
  );

  const res = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as ElevenLabsSTTResponse;
  return data.text ?? "";
}
