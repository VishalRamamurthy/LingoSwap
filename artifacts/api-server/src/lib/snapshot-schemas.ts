/**
 * Zod contracts for the snapshot routes — kept in a pure module (zod only)
 * so contract tests can import them without pulling in express.
 */

import { z } from "zod";

export const SnapshotTranslateBody = z.object({
  image: z.string().min(1, "image is required"),
  mimeType: z.literal("image/jpeg"),
  targetLanguage: z.string().min(1, "targetLanguage is required"),
  sourceLanguage: z.string().optional(),
  mode: z.enum(["text", "menu"]).default("text"),
});

export const MenuItemSchema = z.object({
  id: z.string(),
  originalText: z.string(),
  price: z.string().nullable(),
  translatedText: z.string(),
  isSectionHeader: z.boolean(),
});

export const MenuRetranslateBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        originalText: z.string().min(1),
        price: z.string().nullable(),
        isSectionHeader: z.boolean(),
      }),
    )
    .min(1)
    .max(300),
  targetLanguage: z.string().min(1, "targetLanguage is required"),
  sourceLanguage: z.string().optional(),
});

export const MenuResponseSchema = z.object({
  mode: z.literal("menu"),
  items: z.array(MenuItemSchema),
  targetLanguage: z.string(),
  reason: z.enum(["not_a_menu"]).optional(),
});

export const SnapshotTextResponseSchema = z.object({
  detectedText: z.string(),
  detectedLanguage: z.string().optional(),
  translatedText: z.string(),
  targetLanguage: z.string(),
  reason: z.enum(["no_text_found", "low_confidence"]).optional(),
});
