import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, "../artifacts/translator/locales");

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadLocale(code: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), "utf8"));
}

/** Flatten a nested object to dot-separated paths, e.g. "tabs.translate" */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const result: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result.push(...flattenKeys(v as Record<string, unknown>, key));
    } else {
      result.push(key);
    }
  }
  return result;
}

const LOCALE_CODES = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("i18n locale files", () => {
  let enKeys: string[];

  before(() => {
    const en = loadLocale("en");
    enKeys = flattenKeys(en).sort();
  });

  test("all 37 locale files exist (one per supported language)", () => {
    assert.equal(
      LOCALE_CODES.length,
      37,
      `Expected 37 locale files, found ${LOCALE_CODES.length}: ${LOCALE_CODES.join(", ")}`
    );
  });

  test("every locale file has exactly the same keys as en.json (no missing or extra keys)", () => {
    const mismatches: string[] = [];

    for (const code of LOCALE_CODES) {
      if (code === "en") continue;
      const locale = loadLocale(code);
      const localeKeys = flattenKeys(locale).sort();

      const missing = enKeys.filter((k) => !localeKeys.includes(k));
      const extra = localeKeys.filter((k) => !enKeys.includes(k));

      if (missing.length) mismatches.push(`${code} MISSING: ${missing.join(", ")}`);
      if (extra.length) mismatches.push(`${code} EXTRA: ${extra.join(", ")}`);
    }

    assert.equal(
      mismatches.length,
      0,
      `Key mismatches found:\n${mismatches.join("\n")}`
    );
  });

  test("all locale files have non-empty string values (no blank translations)", () => {
    const blanks: string[] = [];

    for (const code of LOCALE_CODES) {
      const locale = loadLocale(code);
      const keys = flattenKeys(locale);
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = locale;
        for (const p of parts) val = (val as Record<string, unknown>)[p];
        if (typeof val === "string" && val.trim() === "") {
          blanks.push(`${code}.${key}`);
        }
      }
    }

    assert.equal(blanks.length, 0, `Blank values found:\n${blanks.join("\n")}`);
  });

  test("locale data integrity: new keys present, languages differ from English", () => {
    // i18next runs inside Expo (native modules) — we test the data here, not the runtime.

    const en = loadLocale("en") as {
      tabs: { translate: string };
      translate: { fromLabel: string; toLabel: string };
      common: { language: string };
    };

    // 1. New keys are present and non-empty in English (the template locale)
    assert.equal(en.translate.fromLabel, "Translate from");
    assert.equal(en.translate.toLabel, "Translate to");
    assert.equal(en.common.language, "Language");

    // 2. All other locales have different tab.translate values from English (i.e. they were translated)
    //    Use a sample of diverse script families.
    const sampleCodes = ["es", "ar", "ja", "zh", "hi", "ru", "he", "th"];
    for (const code of sampleCodes) {
      const locale = loadLocale(code) as { tabs: { translate: string } };
      assert.notEqual(
        locale.tabs.translate,
        en.tabs.translate,
        `${code}.tabs.translate should differ from English '${en.tabs.translate}', got '${locale.tabs.translate}'`
      );
    }

    // 3. Interpolation placeholder present in conversation.listening key
    //    (used as: t("conversation.listening", { seconds: 5 }))
    const listeningEn = (en as unknown as { conversation: { listening: string } }).conversation;
    assert.ok(
      listeningEn.listening.includes("{{seconds}}"),
      `conversation.listening must contain {{seconds}} placeholder, got: '${listeningEn.listening}'`
    );
  });
});
