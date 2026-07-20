import { Router, type IRouter } from "express";
import { z } from "zod";
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
// OCR  (provider: ocr.space)
// ---------------------------------------------------------------------------

const OCR_ENGINE = process.env.OCR_ENGINE ?? "2"; // 2 = more accurate

interface OcrSpaceResult {
  ParsedResults?: { ParsedText?: string; ErrorMessage?: string; ErrorDetails?: string }[];
  OCRExitCode?: number;
  ErrorMessage?: string | string[];
  IsErroredOnProcessing?: boolean;
}

async function extractText(imageBase64: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    const err = new Error("OCR_SPACE_API_KEY secret is required for Snapshot OCR. Add it in the Replit Secrets panel.");
    (err as Error & { code: string }).code = "ocr_not_configured";
    throw err;
  }

  const body = new URLSearchParams({
    base64Image: `data:image/jpeg;base64,${imageBase64}`,
    apikey: apiKey,
    OCREngine: OCR_ENGINE,
    detectOrientation: "true",
    isTable: "false",
    scale: "true",
  });

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (res.status === 403) {
    const err = new Error("Your OCR.space API key is invalid or unauthorised. Check the OCR_SPACE_API_KEY secret.");
    (err as Error & { code: string }).code = "ocr_invalid_key";
    throw err;
  }

  if (!res.ok) {
    throw new Error(`OCR.space returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as OcrSpaceResult;

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(" ")
      : (data.ErrorMessage ?? "OCR.space processing error");

    // Key-related errors
    if (/unauthori[sz]ed|invalid.*key|api.*key/i.test(msg)) {
      const err = new Error(`OCR.space API key error: ${msg}`);
      (err as Error & { code: string }).code = "ocr_invalid_key";
      throw err;
    }

    throw new Error(msg);
  }

  // OCRExitCode 1 = success, 2 = partially successful, others = failure
  const exitCode = data.OCRExitCode ?? 0;
  if (exitCode !== 1 && exitCode !== 2) {
    throw new Error(`OCR.space exited with code ${exitCode}`);
  }

  const text = (data.ParsedResults ?? [])
    .map((r) => r.ParsedText ?? "")
    .join("\n")
    .trim();

  return text;
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

    const errWithCode = err as Error & { code?: string };
    if (errWithCode.code === "ocr_not_configured") {
      res.status(503).json({ message: errWithCode.message, code: "ocr_not_configured" });
      return;
    }

    if (errWithCode.code === "ocr_invalid_key") {
      res.status(502).json({ message: errWithCode.message, code: "ocr_invalid_key" });
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
