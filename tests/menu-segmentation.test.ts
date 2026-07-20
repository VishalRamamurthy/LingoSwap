import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  detectPrice,
  extractVisualLines,
  segmentMenu,
  mapLanguageToOcrCode,
  type OcrSpaceResponse,
} from "../artifacts/api-server/src/lib/menu-segmentation.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const loadFixture = (name: string): OcrSpaceResponse =>
  JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

// ── Price detection ──────────────────────────────────────────────────────────

test("detectPrice: symbol before ($12.99)", () => {
  const { price, rest } = detectPrice("Cheeseburger $12.99");
  assert.equal(price, "$12.99");
  assert.equal(rest, "Cheeseburger");
});

test("detectPrice: symbol after with comma decimal (12,50 €)", () => {
  const { price, rest } = detectPrice("Spaghetti alla Carbonara 12,50 €");
  assert.equal(price, "12,50 €");
  assert.equal(rest, "Spaghetti alla Carbonara");
});

test("detectPrice: currency code (12.50 EUR)", () => {
  const { price } = detectPrice("Schnitzel 12.50 EUR");
  assert.equal(price, "12.50 EUR");
});

test("detectPrice: suffix unit zł", () => {
  const { price } = detectPrice("Pierogi 24,00 zł");
  assert.equal(price, "24,00 zł");
});

test("detectPrice: bare decimal at end of line", () => {
  const { price, rest } = detectPrice("Tiramisu ..... 6,50");
  assert.equal(price, "6,50");
  assert.equal(rest, "Tiramisu");
});

test("detectPrice: 'Est. 1948' is NOT a price", () => {
  const { price, rest } = detectPrice("Trattoria da Mario — Est. 1948");
  assert.equal(price, null);
  assert.equal(rest, "Trattoria da Mario — Est. 1948");
});

test("detectPrice: plain sentence has no price", () => {
  const { price } = detectPrice("Fresh pasta made daily");
  assert.equal(price, null);
});

test("detectPrice: thousands separator (1 200 ¥)", () => {
  const { price } = detectPrice("Ramen Special 1 200 ¥");
  assert.equal(price, "1 200 ¥");
});

// ── Segmentation on the REAL menu fixture (captured once from OCR.space) ────

test("segmentMenu: real menu fixture → sections + priced items", () => {
  const items = segmentMenu(loadFixture("ocr-menu.json"));

  const headers = items.filter((i) => i.isSectionHeader);
  const dishes = items.filter((i) => !i.isSectionHeader);

  assert.equal(headers.length, 3, "ANTIPASTI / PRIMI / DOLCI headers");
  assert.deepEqual(
    headers.map((h) => h.originalText),
    ["ANTIPASTI", "PRIMI", "DOLCI"],
  );

  assert.equal(dishes.length, 7, "7 dishes");
  // Every dish keeps its verbatim price
  for (const d of dishes) {
    assert.notEqual(d.price, null, `dish "${d.originalText}" should have a price`);
  }
  const carbonara = dishes.find((d) => d.originalText.includes("Carbonara"));
  assert.ok(carbonara);
  assert.equal(carbonara.price, "12,50");
});

test("segmentMenu: prose fixture → too few items to be a menu", () => {
  const items = segmentMenu(loadFixture("ocr-prose.json"));
  // Prose lines have no prices; "1948" must not be detected as a price.
  for (const i of items) assert.equal(i.price, null);
});

test("segmentMenu: blank fixture → zero items", () => {
  const items = segmentMenu(loadFixture("ocr-blank.json"));
  assert.equal(items.length, 0);
});

test("segmentMenu: sign fixture → fewer than 2 non-header items or no prices", () => {
  const items = segmentMenu(loadFixture("ocr-sign.json"));
  const priced = items.filter((i) => i.price !== null);
  assert.equal(priced.length, 0, "a sign has no prices");
});

// ── Structural segmentation behaviors ────────────────────────────────────────

const noOverlay = (text: string): OcrSpaceResponse => ({
  ParsedResults: [{ ParsedText: text, TextOverlay: { Lines: [] } }],
});

test("segmentMenu: continuation lines merge into previous item", () => {
  const items = segmentMenu(
    noOverlay("Coq au Vin 18,00 €\nwith seasonal vegetables\nCrème Brûlée 7,50 €"),
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]!.originalText, "Coq au Vin with seasonal vegetables");
  assert.equal(items[0]!.price, "18,00 €");
});

test("segmentMenu: noise lines (dot leaders, dashes) are dropped", () => {
  const items = segmentMenu(noOverlay("STARTERS\n-----\nSoup 4,50 €\n....."));
  assert.equal(items.length, 2);
  assert.equal(items[0]!.isSectionHeader, true);
});

test("segmentMenu: ALL-CAPS short line without price → section header", () => {
  const items = segmentMenu(noOverlay("DESSERTS\nCheesecake 6,00 €\nBrownie 5,00 €"));
  assert.equal(items[0]!.isSectionHeader, true);
  assert.equal(items[1]!.isSectionHeader, false);
});

test("extractVisualLines: overlay rows group name + price columns", () => {
  const ocr: OcrSpaceResponse = {
    ParsedResults: [
      {
        TextOverlay: {
          Lines: [
            { LineText: "Pizza Margherita", MinTop: 100, MaxHeight: 20, Words: [{ Left: 40 }] },
            { LineText: "9,50", MinTop: 102, MaxHeight: 20, Words: [{ Left: 600 }] },
            { LineText: "Pizza Diavola", MinTop: 160, MaxHeight: 20, Words: [{ Left: 40 }] },
          ],
        },
        ParsedText: "",
      },
    ],
  };
  const lines = extractVisualLines(ocr);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.text, "Pizza Margherita 9,50");
});

// ── Language mapping ─────────────────────────────────────────────────────────

test("mapLanguageToOcrCode: known names map, unknown falls back to auto", () => {
  assert.equal(mapLanguageToOcrCode("French"), "fre");
  assert.equal(mapLanguageToOcrCode("  spanish "), "spa");
  assert.equal(mapLanguageToOcrCode("Klingon"), "auto");
  assert.equal(mapLanguageToOcrCode(undefined), "auto");
});
