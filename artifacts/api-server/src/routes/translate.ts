import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { TranslateTextBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/translate", async (req, res) => {
  const parsed = TranslateTextBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid request",
    });
    return;
  }

  const { text, sourceLanguage, targetLanguage } = parsed.data;
  const autoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto";

  try {
    const systemPrompt = [
      "You are a professional translator.",
      autoDetect
        ? "Detect the language of the user's text, then translate it."
        : `The user's text is in ${sourceLanguage}. Translate it.`,
      `Translate the text into ${targetLanguage}.`,
      "Preserve meaning, tone, and formatting (line breaks, punctuation).",
      'Respond ONLY with a JSON object of this exact shape: {"detectedLanguage": "<English name of the source language>", "translatedText": "<the translation>"}',
      "Do not add explanations, notes, or markdown fences.",
    ].join(" ");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
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
      translatedText,
      detectedLanguage: autoDetect ? detectedLanguage : sourceLanguage,
      targetLanguage,
    });
  } catch (err) {
    req.log.error({ err }, "Translation request failed");
    res.status(502).json({ message: "Translation failed. Please try again." });
  }
});

export default router;
