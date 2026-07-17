import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeepLResponse(text: string, detectedLang = "EN") {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        translations: [{ text, detected_source_language: detectedLang }],
      }),
  };
}

function stubFetch(response: object) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/translate", () => {
  beforeEach(() => {
    process.env.DEEPL_API_KEY = "test-key:fx";
  });

  afterEach(() => {
    delete process.env.DEEPL_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // --- Input validation ---

  it("returns 400 when text is missing", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ targetLanguage: "Spanish" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when targetLanguage is missing", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello" });

    expect(res.status).toBe(400);
  });

  // --- Language name resolution ---

  it("returns 400 for an unsupported target language name", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", targetLanguage: "Klingon" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/unsupported target language/i);
  });

  it("returns 400 for an unsupported source language name", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", sourceLanguage: "Martian", targetLanguage: "Spanish" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/unsupported source language/i);
  });

  // --- Auto-detect flow ---

  it("returns 200 and includes detectedLanguage when sourceLanguage is omitted", async () => {
    stubFetch(makeDeepLResponse("Hola mundo", "EN"));

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello world", targetLanguage: "Spanish" });

    expect(res.status).toBe(200);
    expect(res.body.translatedText).toBe("Hola mundo");
    // DeepL returned "EN" → should be mapped to the name "English"
    expect(res.body.detectedLanguage).toBe("English");
    expect(res.body.targetLanguage).toBe("Spanish");

    // Verify source_lang was NOT sent to DeepL (auto-detect mode)
    const fetchMock = vi.mocked(global.fetch);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.source_lang).toBeUndefined();
  });

  it('treats sourceLanguage="auto" the same as omitting it', async () => {
    stubFetch(makeDeepLResponse("Bonjour", "EN"));

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", sourceLanguage: "auto", targetLanguage: "French" });

    expect(res.status).toBe(200);

    const fetchMock = vi.mocked(global.fetch);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.source_lang).toBeUndefined();
  });

  // --- Explicit source language flow ---

  it("sends source_lang to DeepL when an explicit sourceLanguage is provided", async () => {
    stubFetch(makeDeepLResponse("Hola mundo", "EN"));

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello world", sourceLanguage: "English", targetLanguage: "Spanish" });

    expect(res.status).toBe(200);

    const fetchMock = vi.mocked(global.fetch);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.source_lang).toBe("EN");
  });

  it("returns the explicit sourceLanguage as detectedLanguage (no API detection needed)", async () => {
    stubFetch(makeDeepLResponse("Bonjour", "EN"));

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", sourceLanguage: "English", targetLanguage: "French" });

    expect(res.status).toBe(200);
    // When source is explicit the route echoes back the provided name
    expect(res.body.detectedLanguage).toBe("English");
  });

  // --- Config / API key errors ---

  it("returns 503 when DEEPL_API_KEY is not set", async () => {
    delete process.env.DEEPL_API_KEY;

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", targetLanguage: "Spanish" });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/API key/i);
  });

  it("returns 503 when DeepL returns 403 (invalid key)", async () => {
    stubFetch({ ok: false, status: 403, json: () => Promise.resolve({}) });

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", targetLanguage: "Spanish" });

    expect(res.status).toBe(503);
  });

  it("returns 502 for unexpected DeepL errors", async () => {
    stubFetch({ ok: false, status: 500, json: () => Promise.resolve({}) });

    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", targetLanguage: "Spanish" });

    expect(res.status).toBe(502);
  });
});
