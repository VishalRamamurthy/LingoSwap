/**
 * Contract tests: request/response schemas + graceful handling of malformed
 * OCR responses. No live API calls — fixtures only.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SnapshotTranslateBody,
  MenuRetranslateBody,
  MenuResponseSchema,
} from "../artifacts/api-server/src/lib/snapshot-schemas.ts";
import { segmentMenu } from "../artifacts/api-server/src/lib/menu-segmentation.ts";
import { runMenuPipeline } from "../artifacts/api-server/src/lib/menu-pipeline.ts";

// ── Request schemas ──────────────────────────────────────────────────────────

test("SnapshotTranslateBody: mode defaults to text", () => {
  const parsed = SnapshotTranslateBody.parse({
    image: "abc",
    mimeType: "image/jpeg",
    targetLanguage: "French",
  });
  assert.equal(parsed.mode, "text");
});

test("SnapshotTranslateBody: rejects unknown mode and missing fields", () => {
  assert.equal(
    SnapshotTranslateBody.safeParse({ image: "a", mimeType: "image/jpeg", targetLanguage: "French", mode: "pdf" }).success,
    false,
  );
  assert.equal(SnapshotTranslateBody.safeParse({ mimeType: "image/jpeg", targetLanguage: "x" }).success, false);
  assert.equal(SnapshotTranslateBody.safeParse({ image: "a", mimeType: "image/png", targetLanguage: "x" }).success, false);
});

test("MenuRetranslateBody: rejects empty and oversized item lists", () => {
  assert.equal(
    MenuRetranslateBody.safeParse({ items: [], targetLanguage: "French" }).success,
    false,
  );
  const item = { id: "i", originalText: "Dish", price: null, isSectionHeader: false };
  assert.equal(
    MenuRetranslateBody.safeParse({
      items: Array.from({ length: 301 }, () => item),
      targetLanguage: "French",
    }).success,
    false,
    "more than 300 items rejected",
  );
  assert.equal(
    MenuRetranslateBody.safeParse({ items: [item], targetLanguage: "French" }).success,
    true,
  );
});

// ── Response schema round-trip ───────────────────────────────────────────────

test("MenuResponseSchema accepts pipeline output shape", async () => {
  const result = await runMenuPipeline(
    {
      ocr: async () => ({
        ParsedResults: [
          { ParsedText: "STARTERS\nSoup 4,50 €\nSalad 5,00 €", TextOverlay: { Lines: [] } },
        ],
      }),
      translate: async (payload) =>
        payload
          .split("\n")
          .map((l) => l.replace(/^(\d+)\. (.*)$/, "$1. $2!"))
          .join("\n"),
    },
    "img",
  );
  const response = { mode: "menu", items: result.items, targetLanguage: "French" };
  assert.equal(MenuResponseSchema.safeParse(response).success, true);
});

// ── Malformed OCR responses never throw out of segmentation ─────────────────

test("segmentMenu tolerates malformed OCR payloads", () => {
  assert.deepEqual(segmentMenu({}), []);
  assert.deepEqual(segmentMenu({ ParsedResults: [] }), []);
  assert.deepEqual(segmentMenu({ ParsedResults: [{}] }), []);
  assert.deepEqual(
    segmentMenu({ ParsedResults: [{ TextOverlay: { Lines: [{}, { LineText: "" }] } }] }),
    [],
  );
});

test("runMenuPipeline: not-a-menu photo skips translation entirely", async () => {
  let translateCalls = 0;
  const result = await runMenuPipeline(
    {
      ocr: async () => ({
        ParsedResults: [{ ParsedText: "EXIT", TextOverlay: { Lines: [] } }],
      }),
      translate: async (p) => {
        translateCalls++;
        return p;
      },
    },
    "img",
  );
  assert.equal(result.isLikelyMenu, false);
  assert.equal(translateCalls, 0, "no translation spent on a non-menu");
});
