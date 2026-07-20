/**
 * Batch translation for menu items via a numbered-payload strategy.
 * Pure builders/parsers + an orchestrator with an injected translate fn,
 * so tests can count calls without hitting any network.
 */

export const BATCH_CHUNK_SIZE = 60;

export class BatchMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchMismatchError";
  }
}

/** Escape newlines inside an item so one item is always exactly one line. */
function sanitizeItemText(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, " — ").trim();
}

/** Build the numbered payload: "1. Foo\n2. Bar" */
export function buildBatchPayload(texts: string[]): string {
  return texts.map((t, i) => `${i + 1}. ${sanitizeItemText(t)}`).join("\n");
}

/** Split texts into chunks of at most BATCH_CHUNK_SIZE. */
export function chunkTexts<T>(items: T[], size = BATCH_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Parse a numbered response. Validates count and numbering order.
 * Strips any commentary lines that don't match "N. text".
 * Throws BatchMismatchError on count mismatch or out-of-order numbering.
 */
export function parseBatchResponse(response: string, expectedCount: number): string[] {
  const numbered: { n: number; text: string }[] = [];
  for (const rawLine of response.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,3})\s*[.)。、]\s*(.*)$/u);
    if (!m) continue; // model commentary — strip
    numbered.push({ n: Number(m[1]), text: (m[2] ?? "").trim() });
  }

  if (numbered.length !== expectedCount) {
    throw new BatchMismatchError(
      `Expected ${expectedCount} translated lines, got ${numbered.length}`,
    );
  }
  for (let i = 0; i < numbered.length; i++) {
    if (numbered[i]!.n !== i + 1) {
      throw new BatchMismatchError(
        `Numbering out of order: expected ${i + 1}, got ${numbered[i]!.n}`,
      );
    }
  }
  return numbered.map((x) => x.text);
}

export type TranslateFn = (text: string) => Promise<string>;

export interface BatchTranslateResult {
  translations: string[];
  usedPerItemFallback: boolean;
}

/**
 * Translate N texts with as few calls as possible:
 * one call per 60-item chunk; on a mismatched response retry that chunk once,
 * then fall back to per-item translation for that chunk only.
 */
export async function translateTextsBatched(
  texts: string[],
  translate: TranslateFn,
  onWarn?: (msg: string) => void,
): Promise<BatchTranslateResult> {
  if (texts.length === 0) return { translations: [], usedPerItemFallback: false };

  const out: string[] = [];
  let usedPerItemFallback = false;

  for (const chunk of chunkTexts(texts)) {
    const payload = buildBatchPayload(chunk);

    let parsed: string[] | null = null;
    for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
      try {
        const response = await translate(payload);
        parsed = parseBatchResponse(response, chunk.length);
      } catch (err) {
        if (!(err instanceof BatchMismatchError)) throw err;
        onWarn?.(`Batch translation mismatch (attempt ${attempt + 1}): ${err.message}`);
        parsed = null;
      }
    }

    if (parsed === null) {
      // Per-item fallback — never misalign a translation with the wrong dish.
      onWarn?.("Falling back to per-item translation for one chunk");
      usedPerItemFallback = true;
      parsed = [];
      for (const text of chunk) {
        parsed.push(await translate(sanitizeItemText(text)));
      }
    }

    out.push(...parsed);
  }

  return { translations: out, usedPerItemFallback };
}
