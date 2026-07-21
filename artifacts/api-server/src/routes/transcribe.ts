import { Router, type IRouter } from "express";
import { speechToText, detectAudioFormat } from "@workspace/integrations-openai-ai-server/audio";
import { TranscribeAudioBody } from "@workspace/api-zod";
import { Buffer } from "node:buffer";
import { incrementTranslationCount } from "./auth-stats";

const router: IRouter = Router();

router.post("/transcribe", async (req, res) => {
  const parsed = TranscribeAudioBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid request",
    });
    return;
  }

  const { audioBase64 } = parsed.data;

  try {
    const rawBuffer = Buffer.from(audioBase64, "base64");

    // Reject empty payloads before touching any external service.
    if (rawBuffer.length === 0) {
      res.status(400).json({ message: "No audio data provided." });
      return;
    }

    // Reject formats the pipeline cannot handle so callers get a 4xx, not a 5xx.
    const fmt = detectAudioFormat(rawBuffer);
    if (fmt === "unknown") {
      res.status(400).json({
        message: "Unsupported audio format. Please record in M4A, WAV, MP3, or OGG.",
      });
      return;
    }

    let transcription: string;
    try {
      transcription = await speechToText(rawBuffer);
    } catch (err) {
      req.log.error({ err }, "Speech-to-text failed");
      res
        .status(502)
        .json({ message: "Could not transcribe audio. Please try again." });
      return;
    }

    if (!transcription?.trim()) {
      res.status(400).json({
        message: "No speech detected. Please try speaking more clearly.",
      });
      return;
    }

    void incrementTranslationCount(req, { isVoice: true });
    res.json({ transcription: transcription.trim() });
  } catch (err) {
    req.log.error({ err }, "Transcription request failed");
    res.status(502).json({ message: "Transcription failed. Please try again." });
  }
});

export default router;
