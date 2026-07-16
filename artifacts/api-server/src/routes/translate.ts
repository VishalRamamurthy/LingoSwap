import { Router, type IRouter } from "express";
import { TranslateTextBody } from "@workspace/api-zod";
import {
  translateWithGoogle,
  TranslationConfigError,
  TranslationApiError,
} from "../lib/google-translate";

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
    const result = await translateWithGoogle(
      text,
      targetLanguage,
      autoDetect ? undefined : sourceLanguage,
    );

    res.json({
      translatedText: result.translatedText,
      detectedLanguage: result.detectedLanguage,
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
    req.log.error({ err }, "Translation request failed");
    res.status(502).json({ message: "Translation failed. Please try again." });
  }
});

export default router;
