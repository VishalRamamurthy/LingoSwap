import { Router, type IRouter } from "express";
import {
  speechToText,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import { TranscribeAudioBody } from "@workspace/api-zod";
import { Buffer } from "node:buffer";

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
    const { buffer: audioBuffer, format } = await ensureCompatibleFormat(rawBuffer);

    let transcription: string;
    try {
      transcription = await speechToText(audioBuffer, format);
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

    res.json({ transcription: transcription.trim() });
  } catch (err) {
    req.log.error({ err }, "Transcription request failed");
    res.status(502).json({ message: "Transcription failed. Please try again." });
  }
});

export default router;
