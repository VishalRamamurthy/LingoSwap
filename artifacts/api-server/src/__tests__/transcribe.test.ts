import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";

// Must be hoisted so Vitest intercepts the import before app loads.
vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({
  speechToText: vi.fn(),
  ensureCompatibleFormat: vi.fn(),
}));

// Import after vi.mock so we get the mocked versions.
const { speechToText, ensureCompatibleFormat } = await import(
  "@workspace/integrations-openai-ai-server/audio"
);

const VALID_BODY = {
  audioBase64: Buffer.from("fake audio data").toString("base64"),
  mimeType: "audio/m4a",
};

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: format conversion succeeds
    vi.mocked(ensureCompatibleFormat).mockResolvedValue({
      buffer: Buffer.from("converted"),
      format: "m4a",
    } as any);
  });

  it("returns 200 with transcription on success", async () => {
    vi.mocked(speechToText).mockResolvedValue("Hello, world");

    const res = await request(app).post("/api/transcribe").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ transcription: "Hello, world" });
  });

  it("trims whitespace from the transcription", async () => {
    vi.mocked(speechToText).mockResolvedValue("  Hello world  ");

    const res = await request(app).post("/api/transcribe").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.transcription).toBe("Hello world");
  });

  it("returns 400 when audioBase64 is missing", async () => {
    const res = await request(app)
      .post("/api/transcribe")
      .send({ mimeType: "audio/m4a" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await request(app)
      .post("/api/transcribe")
      .send({ audioBase64: "dGVzdA==" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/transcribe").send({});

    expect(res.status).toBe(400);
  });

  it("returns 400 when no speech is detected (blank transcription)", async () => {
    vi.mocked(speechToText).mockResolvedValue("   ");

    const res = await request(app).post("/api/transcribe").send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no speech/i);
  });

  it("returns 502 when the speech-to-text service throws", async () => {
    vi.mocked(speechToText).mockRejectedValue(new Error("OpenAI unavailable"));

    const res = await request(app).post("/api/transcribe").send(VALID_BODY);

    expect(res.status).toBe(502);
    expect(res.body.message).toBeDefined();
  });
});
