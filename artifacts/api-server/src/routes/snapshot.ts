import { Router, type IRouter } from "express";
import { z } from "zod";
import OpenAI from "openai";
import {
  translateWithDeepL,
  TranslationConfigError,
  TranslationApiError,
} from "../lib/deepl-translate";
import { incrementTranslationCount } from "./auth-stats";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SnapshotTranslateBody = z.object({
  image: z.string().min(1, "image is required"),
  mimeType: z.literal("image/jpeg"),
  targetLanguage: z.string().min(1, "targetLanguage is required"),
  sourceLanguage: z.string().optional(),
});

// 8 MB binary ≈ 10.7 MB base64
const MAX_BASE64_LEN = Math.ceil((8 * 1024 * 1024 * 4) / 3);

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

const OCR_PROVIDER = process.env.OCR_PROVIDER ?? "openai-vision";
const OCR_MODEL = process.env.OCR_MODEL ?? "gpt-4o-mini";

function getOcrClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY secret is required for Snapshot OCR. " +
        "Add it in the Replit Secrets panel.",
    );
  }
  return new OpenAI({ apiKey });
}

async function extractText(imageBase64: string): Promise<string> {
  if (OCR_PROVIDER !== "openai-vision") {
    throw new Error(`Unknown OCR_PROVIDER: ${OCR_PROVIDER}`);
  }

  const ocrClient = getOcrClient();
  const completion = await ocrClient.chat.completions.create({
    model: OCR_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: "Transcribe every piece of visible text in this image verbatim. Preserve the original line breaks and reading order. Return only the raw text with no commentary, explanation, or markdown. If there is no legible text present, return an empty string and nothing else.",
          },
        ],
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Translation (chunked for long text)
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 4_000; // DeepL max is 5,000 chars; leave headroom

async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
): Promise<{ translatedText: string; detectedLanguage?: string }> {
  if (text.length <= CHUNK_SIZE) {
    const r = await translateWithDeepL(text, targetLanguage, sourceLanguage);
    return { translatedText: r.translatedText, detectedLanguage: r.detectedLanguage };
  }

  // Split on paragraph boundaries, falling back to raw length splits
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current.trim());

  const results = await Promise.all(
    chunks.map((c) => translateWithDeepL(c, targetLanguage, sourceLanguage)),
  );

  return {
    translatedText: results.map((r) => r.translatedText).join("\n\n"),
    detectedLanguage: results[0]?.detectedLanguage,
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const router: IRouter = Router();

router.post("/snapshot/translate", async (req, res) => {
  const parsed = SnapshotTranslateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { image, targetLanguage, sourceLanguage } = parsed.data;

  if (image.length > MAX_BASE64_LEN) {
    res.status(413).json({ message: "Image is too large. Please use a smaller photo (max 8 MB)." });
    return;
  }

  // ── OCR ─────────────────────────────────────────────────────────────────
  let detectedText: string;
  try {
    detectedText = await extractText(image);
  } catch (err) {
    const errorMessage = (err as Error).message ?? String(err);
    req.log.error({ err: errorMessage }, "OCR failed");

    if (errorMessage.includes("OPENAI_API_KEY secret is required")) {
      res.status(503).json({
        message: "Snapshot OCR is not configured. Add the OPENAI_API_KEY secret in your Replit settings.",
        code: "ocr_not_configured",
      });
      return;
    }

    if (errorMessage.includes("401") || errorMessage.includes("Incorrect API key")) {
      res.status(502).json({
        message: "Your OpenAI API key is invalid. Check the OPENAI_API_KEY secret.",
        code: "ocr_invalid_key",
      });
      return;
    }

    res.status(502).json({ message: "Could not read text from the image. Please try again." });
    return;
  }

  if (!detectedText) {
    res.json({ detectedText: "", translatedText: "", targetLanguage, reason: "no_text_found" });
    return;
  }

  // ── Translation ──────────────────────────────────────────────────────────
  const autoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto";

  let translationResult: { translatedText: string; detectedLanguage?: string };
  try {
    translationResult = await translateText(
      detectedText,
      targetLanguage,
      autoDetect ? undefined : sourceLanguage,
    );
  } catch (err) {
    if (err instanceof TranslationConfigError) {
      res.status(503).json({ message: err.message });
      return;
    }
    if (err instanceof TranslationApiError && err.status === 400) {
      res.status(400).json({ message: err.message });
      return;
    }
    req.log.error({ err: (err as Error).message }, "Translation failed in snapshot route");
    res.status(502).json({ message: "Translation failed. Please try again." });
    return;
  }

  void incrementTranslationCount(req);

  res.json({
    detectedText,
    detectedLanguage: translationResult.detectedLanguage,
    translatedText: translationResult.translatedText,
    targetLanguage,
  });
});

export default router;
