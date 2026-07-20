/**
 * Pure menu-segmentation logic for Snapshot "Menu" mode.
 * NO network calls, NO env access — fully unit-testable.
 */

// ---------------------------------------------------------------------------
// OCR.space response types (overlay shape)
// ---------------------------------------------------------------------------

export interface OcrOverlayWord {
  WordText?: string;
  Left?: number;
  Top?: number;
  Height?: number;
  Width?: number;
}

export interface OcrOverlayLine {
  LineText?: string;
  Words?: OcrOverlayWord[];
  MaxHeight?: number;
  MinTop?: number;
}

export interface OcrTextOverlay {
  Lines?: OcrOverlayLine[];
  HasOverlay?: boolean;
}

export interface OcrParsedResult {
  TextOverlay?: OcrTextOverlay;
  ParsedText?: string;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

export interface OcrSpaceResponse {
  ParsedResults?: OcrParsedResult[];
  OCRExitCode?: number;
  ErrorMessage?: string | string[];
  IsErroredOnProcessing?: boolean;
}

// ---------------------------------------------------------------------------
// Menu item type
// ---------------------------------------------------------------------------

export type MenuItem = {
  id: string;
  originalText: string; // dish name / description, price stripped
  price: string | null; // verbatim, e.g. "12,50 €" — NEVER translated/reformatted
  translatedText: string; // filled in later
  isSectionHeader: boolean;
};

// ---------------------------------------------------------------------------
// Price detection
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS = "\\$€£¥₩₹฿";
// symbol-adjacent numbers, currency codes, or suffix units (zł, kr)
const NUM = "\\d{1,3}(?:[ .,\\u00A0]\\d{3})*(?:[.,]\\d{1,2})?";

const PRICE_PATTERNS: RegExp[] = [
  // Symbol before: $12.99, € 12,50
  new RegExp(`[${CURRENCY_SYMBOLS}]\\s?${NUM}`, "u"),
  // Symbol after: 12,50 €, 1 200 ¥
  new RegExp(`${NUM}\\s?[${CURRENCY_SYMBOLS}]`, "u"),
  // 3-letter code before/after: USD 12.50, 12.50 EUR
  new RegExp(`\\b(?:USD|EUR|GBP|JPY|KRW|INR|THB|PLN|SEK|NOK|DKK|CHF|CAD|AUD)\\s?${NUM}`, "iu"),
  new RegExp(`${NUM}\\s?(?:USD|EUR|GBP|JPY|KRW|INR|THB|PLN|SEK|NOK|DKK|CHF|CAD|AUD)\\b`, "iu"),
  // Suffix word units: 12,50 zł / 120 kr
  new RegExp(`${NUM}\\s?(?:zł|kr)(?=\\s|$|[.,;])`, "iu"),
  // Bare decimal price at end of line: "Carbonara 12.50" / "…… 12,50"
  new RegExp(`(?:^|\\s)\\d{1,4}[.,]\\d{2}\\s*$`, "u"),
];

/**
 * Detect a price in a line. Returns the verbatim price string and the line
 * with the price (and trailing dot-leaders) stripped.
 */
export function detectPrice(line: string): { price: string | null; rest: string } {
  for (const re of PRICE_PATTERNS) {
    const m = line.match(re);
    if (m && m[0]) {
      const price = m[0].trim();
      // Guard: a bare 4-digit integer that looks like a year is NOT a price
      // (only applies to patterns without a currency marker).
      if (!/[$€£¥₩₹฿]|USD|EUR|GBP|JPY|KRW|INR|THB|PLN|SEK|NOK|DKK|CHF|CAD|AUD|zł|kr/iu.test(price)) {
        if (/^\d{4}$/.test(price.replace(/[.,\s]/g, "")) && !/[.,]\d{2}$/.test(price)) {
          continue;
        }
      }
      const rest = line
        .replace(m[0], " ")
        .replace(/[.\u00B7•]{2,}\s*/g, " ") // dot leaders
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/[\s.,·•-]+$/u, "");
      return { price, rest };
    }
  }
  return { price: null, rest: line.trim() };
}

// ---------------------------------------------------------------------------
// Line extraction from overlay (grouping words into visual rows)
// ---------------------------------------------------------------------------

interface VisualLine {
  text: string;
  maxHeight: number;
}

/** Group overlay lines that sit on the same visual row (name + price columns). */
export function extractVisualLines(ocr: OcrSpaceResponse): VisualLine[] {
  const parsed = ocr.ParsedResults?.[0];
  const overlayLines = parsed?.TextOverlay?.Lines;

  if (overlayLines && overlayLines.length > 0) {
    // Sort by vertical position, then group rows whose MinTop are within
    // ~60% of the line height of each other.
    const sorted = [...overlayLines]
      .filter((l) => (l.LineText ?? "").trim().length > 0)
      .sort((a, b) => (a.MinTop ?? 0) - (b.MinTop ?? 0));

    const rows: { tops: number[]; heights: number[]; parts: { left: number; text: string }[] }[] = [];

    for (const line of sorted) {
      const top = line.MinTop ?? 0;
      const height = line.MaxHeight ?? 12;
      const left = line.Words?.[0]?.Left ?? 0;
      const text = (line.LineText ?? "").trim();

      const current = rows[rows.length - 1];
      if (
        current &&
        Math.abs(top - current.tops[current.tops.length - 1]!) <= Math.max(height, current.heights[0]!) * 0.6
      ) {
        current.tops.push(top);
        current.heights.push(height);
        current.parts.push({ left, text });
      } else {
        rows.push({ tops: [top], heights: [height], parts: [{ left, text }] });
      }
    }

    return rows.map((r) => ({
      text: r.parts
        .sort((a, b) => a.left - b.left)
        .map((p) => p.text)
        .join(" ")
        .trim(),
      maxHeight: Math.max(...r.heights),
    }));
  }

  // Fallback: no overlay → split ParsedText on newlines
  const raw = parsed?.ParsedText ?? "";
  return raw
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text) => ({ text, maxHeight: 0 }));
}

// ---------------------------------------------------------------------------
// Noise / header helpers
// ---------------------------------------------------------------------------

function isNoise(text: string): boolean {
  const stripped = text.replace(/[.\u00B7•\s\-_=~*]+/gu, "");
  return stripped.length < 2;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function looksLikeHeader(text: string, maxHeight: number, medianHeight: number): boolean {
  if (text.length > 30) return false;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return false;
  const isAllCaps = letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  const isTaller = medianHeight > 0 && maxHeight > medianHeight * 1.3;
  return isAllCaps || isTaller;
}

// ---------------------------------------------------------------------------
// Main segmentation
// ---------------------------------------------------------------------------

export function segmentMenu(ocr: OcrSpaceResponse): MenuItem[] {
  const lines = extractVisualLines(ocr);
  const medianHeight = median(lines.map((l) => l.maxHeight).filter((h) => h > 0));

  const items: MenuItem[] = [];
  let seq = 0;

  for (const line of lines) {
    if (isNoise(line.text)) continue;

    const { price, rest } = detectPrice(line.text);
    const text = rest.trim();

    if (!text && !price) continue;
    if (!text && price) continue; // price-only line: noise (already-captured column)

    // Continuation line: no price, starts lowercase, previous item has a price
    const prev = items[items.length - 1];
    if (
      !price &&
      prev &&
      !prev.isSectionHeader &&
      prev.price !== null &&
      /^\p{Ll}/u.test(text)
    ) {
      prev.originalText = `${prev.originalText} ${text}`.trim();
      continue;
    }

    const isSectionHeader = !price && looksLikeHeader(text, line.maxHeight, medianHeight);

    items.push({
      id: `item-${seq++}`,
      originalText: text,
      price,
      translatedText: "",
      isSectionHeader,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// App language name → OCR.space language code
// ---------------------------------------------------------------------------

const OCR_LANGUAGE_CODES: Record<string, string> = {
  arabic: "ara",
  bulgarian: "bul",
  chinese: "chs",
  croatian: "hrv",
  czech: "cze",
  danish: "dan",
  dutch: "dut",
  english: "eng",
  finnish: "fin",
  french: "fre",
  german: "ger",
  greek: "gre",
  hungarian: "hun",
  italian: "ita",
  japanese: "jpn",
  korean: "kor",
  polish: "pol",
  portuguese: "por",
  russian: "rus",
  slovenian: "slv",
  spanish: "spa",
  swedish: "swe",
  turkish: "tur",
};

/** Map an app language name to an OCR.space 3-letter code; fall back to "auto". */
export function mapLanguageToOcrCode(name?: string): string {
  if (!name) return "auto";
  return OCR_LANGUAGE_CODES[name.trim().toLowerCase()] ?? "auto";
}
