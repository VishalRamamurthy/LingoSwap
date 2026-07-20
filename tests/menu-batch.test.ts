import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BATCH_CHUNK_SIZE,
  buildBatchPayload,
  chunkTexts,
  parseBatchResponse,
  translateTextsBatched,
  BatchMismatchError,
} from "../artifacts/api-server/src/lib/menu-batch.ts";

test("buildBatchPayload numbers items and flattens embedded newlines", () => {
  const payload = buildBatchPayload(["Soup", "Steak\nwith fries"]);
  assert.equal(payload, "1. Soup\n2. Steak — with fries");
});

test("chunkTexts splits at 60", () => {
  assert.equal(BATCH_CHUNK_SIZE, 60);
  const chunks = chunkTexts(Array.from({ length: 150 }, (_, i) => `item ${i}`));
  assert.deepEqual(chunks.map((c) => c.length), [60, 60, 30]);
});

test("parseBatchResponse strips commentary lines", () => {
  const out = parseBatchResponse(
    "Here are your translations:\n1. Sopa\n2. Filete\nHope that helps!",
    2,
  );
  assert.deepEqual(out, ["Sopa", "Filete"]);
});

test("parseBatchResponse throws on count mismatch", () => {
  assert.throws(() => parseBatchResponse("1. Sopa", 2), BatchMismatchError);
});

test("parseBatchResponse throws on out-of-order numbering", () => {
  assert.throws(() => parseBatchResponse("1. A\n3. B", 2), BatchMismatchError);
});

test("translateTextsBatched: happy path uses ONE call for 30 items", async () => {
  let calls = 0;
  const translate = async (payload: string) => {
    calls++;
    return payload
      .split("\n")
      .map((l) => l.replace(/^(\d+)\. (.*)$/, (_, n, t) => `${n}. [x]${t}`))
      .join("\n");
  };
  const texts = Array.from({ length: 30 }, (_, i) => `dish ${i}`);
  const { translations, usedPerItemFallback } = await translateTextsBatched(texts, translate);
  assert.equal(calls, 1);
  assert.equal(usedPerItemFallback, false);
  assert.equal(translations.length, 30);
  assert.equal(translations[7], "[x]dish 7");
});

test("translateTextsBatched: retry once then per-item fallback keeps alignment", async () => {
  const texts = ["A", "B", "C"];
  let calls = 0;
  const translate = async (payload: string) => {
    calls++;
    if (calls <= 2) return "garbage response with no numbering";
    return `t:${payload}`; // per-item calls
  };
  const warns: string[] = [];
  const { translations, usedPerItemFallback } = await translateTextsBatched(
    texts,
    translate,
    (m) => warns.push(m),
  );
  assert.equal(usedPerItemFallback, true);
  assert.equal(calls, 2 + 3, "2 batch attempts + 3 per-item calls");
  assert.deepEqual(translations, ["t:A", "t:B", "t:C"]);
  assert.ok(warns.length >= 2);
});

test("translateTextsBatched: non-mismatch errors propagate", async () => {
  await assert.rejects(
    translateTextsBatched(["A"], async () => {
      throw new Error("network down");
    }),
    /network down/,
  );
});
