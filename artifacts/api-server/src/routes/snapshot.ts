import { Router, type IRouter } from "express";
import { SnapshotTranslateBody, MenuRetranslateBody } from "../lib/snapshot-schemas";
import {
  translateWithDeepL,
  TranslationConfigError,
  TranslationApiError,
} from "../lib/deepl-translate";
import { ocrSpaceRequest, extractParsedText, OcrError } from "../lib/ocr-space";
import { runMenuPipeline, translateMenuItems } from "../lib/menu-pipeline";
import type { MenuItem } from "../lib/menu-segmentation";
import { incrementTranslationCount } from "./auth-stats";

// 8 MB binary ≈ 10.7 MB base64
const MAX_BASE64_LEN = Math.ceil((8 * 1024 * 1024 * 4) / 3);

// ---------------------------------------------------------------------------
// Translation (chunked for long text — Text mode)
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
// Error → HTTP mapping helpers
// ---------------------------------------------------------------------------

function sendOcrError(res: { status: (n: number) => { json: (b: unknown) => void } }, err: unknown): void {
  const e = err as Error & { code?: string };
  if (e instanceof OcrError && e.code === "ocr_not_configured") {
    res.status(503).json({ message: e.message, code: "ocr_not_configured" });
    return;
  }
  if (e instanceof OcrError && e.code === "ocr_invalid_key") {
    res.status(502).json({ message: e.message, code: "ocr_invalid_key" });
    return;
  }
  res.status(502).json({ message: "Could not read text from the image. Please try again." });
}

function sendTranslationError(res: { status: (n: number) => { json: (b: unknown) => void } }, err: unknown): boolean {
  if (err instanceof TranslationConfigError) {
    res.status(503).json({ message: err.message });
    return true;
  }
  if (err instanceof TranslationApiError && err.status === 400) {
    res.status(400).json({ message: err.message });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const router: IRouter = Router();

router.post("/snapshot/translate", async (req, res) => {
  const parsed = SnapshotTranslateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { image, targetLanguage, sourceLanguage, mode } = parsed.data;

  // Oversized payloads are rejected BEFORE any outbound request.
  if (image.length > MAX_BASE64_LEN) {
    res.status(413).json({ message: "Image is too large. Please use a smaller photo (max 8 MB)." });
    return;
  }

  const autoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto";
  const srcLang = autoDetect ? undefined : sourceLanguage;

  // ── MENU MODE ────────────────────────────────────────────────────────────
  if (mode === "menu") {
    try {
      const result = await runMenuPipeline(
        {
          ocr: (img, opts) => ocrSpaceRequest(img, opts),
          translate: async (payload) =>
            (await translateWithDeepL(payload, targetLanguage, srcLang)).translatedText,
          warn: (msg) => req.log.warn(msg),
        },
        image,
      );

      if (!result.isLikelyMenu) {
        res.json({ mode: "menu", items: result.items, targetLanguage, reason: "not_a_menu" });
        return;
      }

      void incrementTranslationCount(req);
      res.json({ mode: "menu", items: result.items, targetLanguage });
      return;
    } catch (err) {
      if (err instanceof OcrError) {
        req.log.error({ err: err.message }, "Menu OCR failed");
        sendOcrError(res, err);
        return;
      }
      if (sendTranslationError(res, err)) return;
      req.log.error({ err: (err as Error).message }, "Menu pipeline failed");
      res.status(502).json({ message: "Could not analyse the menu. Please try again." });
      return;
    }
  }

  // ── TEXT MODE (existing behaviour) ───────────────────────────────────────
  let detectedText: string;
  try {
    const ocrData = await ocrSpaceRequest(image, { isTable: false, isOverlayRequired: false });
    detectedText = extractParsedText(ocrData);
  } catch (err) {
    req.log.error({ err: (err as Error).message }, "OCR failed");
    sendOcrError(res, err);
    return;
  }

  if (!detectedText) {
    res.json({ detectedText: "", translatedText: "", targetLanguage, reason: "no_text_found" });
    return;
  }

  let translationResult: { translatedText: string; detectedLanguage?: string };
  try {
    translationResult = await translateText(detectedText, targetLanguage, srcLang);
  } catch (err) {
    if (sendTranslationError(res, err)) return;
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

// Re-translate cached menu items on language change — ZERO OCR calls.
router.post("/snapshot/menu/retranslate", async (req, res) => {
  const parsed = MenuRetranslateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { items, targetLanguage, sourceLanguage } = parsed.data;
  const autoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto";

  try {
    const translated = await translateMenuItems(
      items.map((i): MenuItem => ({ ...i, translatedText: "" })),
      async (payload) =>
        (await translateWithDeepL(payload, targetLanguage, autoDetect ? undefined : sourceLanguage))
          .translatedText,
      (msg) => req.log.warn(msg),
    );
    void incrementTranslationCount(req);
    res.json({ mode: "menu", items: translated, targetLanguage });
  } catch (err) {
    if (sendTranslationError(res, err)) return;
    req.log.error({ err: (err as Error).message }, "Menu retranslate failed");
    res.status(502).json({ message: "Translation failed. Please try again." });
  }
});

export default router;
