import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { speechToText } from "@workspace/integrations-openai-ai-server/audio";
import { VoiceTranslateBody } from "@workspace/api-zod";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

router.post("/voice-translate", async (req, res) => {
  const parsed = VoiceTranslateBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid request",
    });
    return;
  }

  const { audioBase64, mimeType, targetLanguage, sourceLanguage } = parsed.data;
  const autoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto";

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Step 1: Transcribe the audio
    let transcription: string;
    try {
      transcription = await speechToText(audioBuffer);
    } catch (err) {
      req.log.error({ err }, "Speech-to-text failed");
      res.status(502).json({ message: "Could not transcribe audio. Please try again." });
      return;
    }

    if (!transcription?.trim()) {
      res.status(400).json({ message: "No speech detected. Please try speaking more clearly." });
      return;
    }

    // Step 2: Detect language + translate
    const systemPrompt = [
      "You are a professional translator.",
      autoDetect
        ? "Detect the language of the user's text, then translate it."
        : `The user's text is in ${sourceLanguage}. Translate it.`,
      `Translate the text into ${targetLanguage}.`,
      "Preserve meaning, tone, and formatting.",
      'Respond ONLY with a JSON object of this exact shape: {"detectedLanguage": "<English name of the source language>", "translatedText": "<the translation>"}',
      "Do not add explanations, notes, or markdown fences.",
    ].join(" ");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcription },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      res.status(502).json({ message: "Translation service returned no result" });
      return;
    }

    let detectedLanguage: string;
    let translatedText: string;
    try {
      const json = JSON.parse(raw) as {
        detectedLanguage?: unknown;
        translatedText?: unknown;
      };
      if (
        typeof json.detectedLanguage !== "string" ||
        typeof json.translatedText !== "string"
      ) {
        throw new Error("Malformed translation payload");
      }
      detectedLanguage = json.detectedLanguage;
      translatedText = json.translatedText;
    } catch {
      req.log.error({ raw }, "Failed to parse translation model output");
      res.status(502).json({ message: "Translation service returned an unexpected response" });
      return;
    }

    res.json({
      transcription,
      detectedLanguage: autoDetect ? detectedLanguage : sourceLanguage,
      translatedText,
      targetLanguage,
    });
  } catch (err) {
    req.log.error({ err }, "Voice translation request failed");
    res.status(502).json({ message: "Voice translation failed. Please try again." });
  }
});

export default router;
