/**
 * Menu-mode orchestration with injected OCR + translate clients.
 * Pure wiring — lets tests assert exact call counts (1 OCR + 1 translation
 * for a 30-item menu, 3 translation calls for 150 items, 0 OCR on language
 * change) with mocked clients.
 */

import { segmentMenu, type MenuItem, type OcrSpaceResponse } from "./menu-segmentation.ts";
import { translateTextsBatched, type TranslateFn } from "./menu-batch.ts";

export type OcrFn = (imageBase64: string, opts: { isTable: boolean; isOverlayRequired: boolean }) => Promise<OcrSpaceResponse>;

export interface MenuPipelineDeps {
  ocr: OcrFn;
  translate: TranslateFn;
  warn?: (msg: string) => void;
}

export interface MenuPipelineResult {
  items: MenuItem[];
  isLikelyMenu: boolean;
}

/** Translate cached items — used both by the pipeline and the re-translate route. NO OCR involved. */
export async function translateMenuItems(
  items: MenuItem[],
  translate: TranslateFn,
  warn?: (msg: string) => void,
): Promise<MenuItem[]> {
  const { translations } = await translateTextsBatched(
    items.map((i) => i.originalText),
    translate,
    warn,
  );
  return items.map((item, i) => ({ ...item, translatedText: translations[i] ?? "" }));
}

/** Full menu pipeline: exactly ONE OCR call, then batched translation. */
export async function runMenuPipeline(
  deps: MenuPipelineDeps,
  imageBase64: string,
): Promise<MenuPipelineResult> {
  const ocrResult = await deps.ocr(imageBase64, { isTable: true, isOverlayRequired: true });
  const segmented = segmentMenu(ocrResult);

  const nonHeaderCount = segmented.filter((i) => !i.isSectionHeader).length;
  const isLikelyMenu = segmented.length >= 2 && nonHeaderCount >= 2;

  if (!isLikelyMenu) {
    return { items: segmented, isLikelyMenu: false };
  }

  const items = await translateMenuItems(segmented, deps.translate, deps.warn);
  return { items, isLikelyMenu: true };
}
