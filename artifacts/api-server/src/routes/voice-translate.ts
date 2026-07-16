import { Router, type IRouter } from "express";
import { speechToText, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";
import { VoiceTranslateBody } from "@workspace/api-zod";
import { Buffer } from "node:buffer";
import {
  translateWithDeepL,
  TranslationConfigError,
  TranslationApiError,
} from "../lib/deepl-translate";

const router: IRouter = Router();

router.post("/voice-translate", async (req, res) => {
  const parsed = VoiceTranslateBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid request",
    });
    return;
  }

  const { audioBase64, targetLanguage, sourceLanguage } = parsed.data;
  const autoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto";

  try {
    const rawBuffer = Buffer.from(audioBase64, "base64");
    const { buffer: audioBuffer, format } = await ensureCompatibleFormat(rawBuffer);

    // Step 1: Transcribe the audio with Whisper (auto-detected format)
    let transcription: string;
    try {
      transcription = await speechToText(audioBuffer, format);
    } catch (err) {
      req.log.error({ err }, "Speech-to-text failed");
      res.status(502).json({ message: "Could not transcribe audio. Please try again." });
      return;
    }

    if (!transcription?.trim()) {
      res.status(400).json({ message: "No speech detected. Please try speaking more clearly." });
      return;
    }

    // Step 2: Translate with DeepL (also detects language)
    const result = await translateWithDeepL(
      transcription,
      targetLanguage,
      autoDetect ? undefined : sourceLanguage,
    );

    res.json({
      transcription,
      detectedLanguage: result.detectedLanguage,
      translatedText: result.translatedText,
      targetLanguage,
    });
  } catch (err) {
    if (err instanceof TranslationConfigError) {
      res.status(503).json({ message: err.message });
      return;
    }
    if (err instanceof TranslationApiError && err.status === 400) {
      res.status(400).json({ message: err.message });
      return;
    }
    req.log.error({ err }, "Voice translation request failed");
    res.status(502).json({ message: "Voice translation failed. Please try again." });
  }
});

export default router;
