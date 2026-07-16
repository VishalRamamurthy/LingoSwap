import { Router, type IRouter } from "express";
import { TextToSpeechBody } from "@workspace/api-zod";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

// Default multilingual voice (ElevenLabs "Brian") + multilingual model
const DEFAULT_VOICE_ID = "nPczCjzI2devNBz1zQrb";
const MODEL_ID = "eleven_multilingual_v2";

router.post("/tts", async (req, res) => {
  const parsed = TextToSpeechBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid request",
    });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      message:
        "Voice playback isn't set up yet: the ElevenLabs API key is missing. Add the ELEVENLABS_API_KEY secret to fix this.",
    });
    return;
  }

  const { text } = parsed.data;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
        }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      res.status(503).json({
        message:
          "The ElevenLabs API key appears to be invalid. Double-check the ELEVENLABS_API_KEY secret.",
      });
      return;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      req.log.error({ status: response.status, body }, "ElevenLabs TTS failed");
      res.status(502).json({
        message: "Could not generate audio right now. Please try again.",
      });
      return;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.json({
      audioBase64: audio.toString("base64"),
      mimeType: "audio/mpeg",
    });
  } catch (err) {
    req.log.error({ err }, "TTS request failed");
    res.status(502).json({
      message: "Could not generate audio right now. Please try again.",
    });
  }
});

export default router;
