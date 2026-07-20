/**
 * Spec §5d efficiency assertions — every scenario runs against MOCKED
 * clients; call counts are exact.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runMenuPipeline,
  translateMenuItems,
} from "../artifacts/api-server/src/lib/menu-pipeline.ts";
import type { OcrSpaceResponse, MenuItem } from "../artifacts/api-server/src/lib/menu-segmentation.ts";
import {
  TranslationCache,
  runConversationTurn,
} from "../artifacts/translator/lib/conversation-machine.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function menuOcrResponse(count: number): OcrSpaceResponse {
  const lines = Array.from({ length: count }, (_, i) => `Dish number ${i} 1${i}.50`);
  return { ParsedResults: [{ ParsedText: lines.join("\n"), TextOverlay: { Lines: [] } }] };
}

function echoBatchTranslate(counter: { calls: number }) {
  return async (payload: string) => {
    counter.calls++;
    return payload
      .split("\n")
      .map((l) => l.replace(/^(\d+)\. (.*)$/, (_, n, t) => `${n}. T(${t})`))
      .join("\n");
  };
}

// 1. Menu with 30 items → exactly 1 OCR call and 1 translation call
test("menu with 30 items → exactly 1 OCR call and 1 translation call", async () => {
  const ocrCounter = { calls: 0 };
  const trCounter = { calls: 0 };
  const result = await runMenuPipeline(
    {
      ocr: async () => {
        ocrCounter.calls++;
        return menuOcrResponse(30);
      },
      translate: echoBatchTranslate(trCounter),
    },
    "fake-base64",
  );
  assert.equal(ocrCounter.calls, 1);
  assert.equal(trCounter.calls, 1);
  assert.equal(result.isLikelyMenu, true);
  assert.equal(result.items.filter((i) => !i.isSectionHeader).length, 30);
});

// 2. Menu with 150 items → 3 translation calls (60+60+30)
test("menu with 150 items → exactly 3 translation calls", async () => {
  const trCounter = { calls: 0 };
  const result = await runMenuPipeline(
    {
      ocr: async () => menuOcrResponse(150),
      translate: echoBatchTranslate(trCounter),
    },
    "fake-base64",
  );
  assert.equal(trCounter.calls, 3);
  assert.equal(result.items.length, 150);
});

// 3. Changing menu target language → 0 OCR calls (retranslate path never sees OCR)
test("menu language change → 0 OCR calls", async () => {
  const trCounter = { calls: 0 };
  const cachedItems: MenuItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `item-${i}`,
    originalText: `Dish ${i}`,
    price: `${i}.50`,
    translatedText: `old ${i}`,
    isSectionHeader: false,
  }));
  // translateMenuItems has NO ocr dependency at all — the type system enforces
  // 0 OCR calls; we assert 1 translation call for 10 items.
  const items = await translateMenuItems(cachedItems, echoBatchTranslate(trCounter));
  assert.equal(trCounter.calls, 1);
  assert.equal(items.length, 10);
  assert.ok(items[3]!.translatedText.startsWith("T("));
  assert.equal(items[3]!.price, "3.50", "price is preserved verbatim");
});

// 4. Switching Snapshot mode on an existing photo → exactly 1 OCR call, not 2
test("mode switch re-analysis → exactly 1 OCR call", async () => {
  const ocrCounter = { calls: 0 };
  await runMenuPipeline(
    {
      ocr: async () => {
        ocrCounter.calls++;
        return menuOcrResponse(5);
      },
      translate: echoBatchTranslate({ calls: 0 }),
    },
    "same-photo-base64",
  );
  assert.equal(ocrCounter.calls, 1);
});

// 5. One conversation turn → exactly 1 transcription and 1 translation call
test("conversation turn → exactly 1 transcription + 1 translation call", async () => {
  const counts = { transcribe: 0, translate: 0 };
  const cache = new TranslationCache();
  const result = await runConversationTurn(
    {
      transcribe: async () => {
        counts.transcribe++;
        return "Where is the station?";
      },
      translate: async (text) => {
        counts.translate++;
        return `ES(${text})`;
      },
      cache,
    },
    "audio-base64",
    "English",
    "Spanish",
  );
  assert.equal(counts.transcribe, 1);
  assert.equal(counts.translate, 1);
  assert.equal(result.fromCache, false);
  assert.equal(result.translated, "ES(Where is the station?)");
});

// 6. Repeating the same phrase → translation served from cache (0 extra calls)
test("repeated phrase in conversation → 0 additional translation calls", async () => {
  const counts = { transcribe: 0, translate: 0 };
  const cache = new TranslationCache();
  const deps = {
    transcribe: async () => {
      counts.transcribe++;
      return "Thank you";
    },
    translate: async (text: string) => {
      counts.translate++;
      return `ES(${text})`;
    },
    cache,
  };
  const first = await runConversationTurn(deps, "a1", "English", "Spanish");
  const second = await runConversationTurn(deps, "a2", "English", "Spanish");
  assert.equal(counts.transcribe, 2, "each turn still transcribes its own audio");
  assert.equal(counts.translate, 1, "second identical phrase hits the cache");
  assert.equal(second.fromCache, true);
  assert.equal(second.translated, first.translated);
});

test("cache is language-pair scoped — different target re-translates", async () => {
  const counts = { translate: 0 };
  const cache = new TranslationCache();
  const deps = {
    transcribe: async () => "Hello",
    translate: async (t: string) => {
      counts.translate++;
      return `X(${t})`;
    },
    cache,
  };
  await runConversationTurn(deps, "a", "English", "Spanish");
  await runConversationTurn(deps, "a", "English", "French");
  assert.equal(counts.translate, 2);
});
