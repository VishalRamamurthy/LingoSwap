import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ELEVENLABS_API_KEY;
});

describe("POST /api/tts", () => {
  // --- Input validation (no API key needed — schema runs first) ---

  it("returns 400 when text is missing", async () => {
    const res = await request(app).post("/api/tts").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("returns 400 when text is an empty string", async () => {
    const res = await request(app).post("/api/tts").send({ text: "" });
    expect(res.status).toBe(400);
  });

  // --- Config errors ---

  it("returns 503 when ELEVENLABS_API_KEY is not set", async () => {
    const res = await request(app).post("/api/tts").send({ text: "Hello world" });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/ElevenLabs API key/i);
  });

  // --- Success ---

  it("returns 200 with base64-encoded audio on success", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";

    // Build a standalone ArrayBuffer so Buffer.from() round-trips cleanly.
    const fakeBytes = new Uint8Array([0x49, 0x44, 0x33, 0xff, 0xfe]);
    const fakeArrayBuffer = fakeBytes.buffer;
    const expectedBase64 = Buffer.from(fakeArrayBuffer).toString("base64");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(fakeArrayBuffer),
      }),
    );

    const res = await request(app).post("/api/tts").send({ text: "Hello world" });

    expect(res.status).toBe(200);
    expect(res.body.audioBase64).toBe(expectedBase64);
    expect(res.body.mimeType).toBe("audio/mpeg");
  });

  it("returns 503 when ElevenLabs returns 401 (invalid key)", async () => {
    process.env.ELEVENLABS_API_KEY = "bad-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve("") }),
    );

    const res = await request(app).post("/api/tts").send({ text: "Hello world" });
    expect(res.status).toBe(503);
  });

  it("returns 502 for unexpected ElevenLabs errors", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("internal error"),
      }),
    );

    const res = await request(app).post("/api/tts").send({ text: "Hello world" });
    expect(res.status).toBe(502);
  });
});
