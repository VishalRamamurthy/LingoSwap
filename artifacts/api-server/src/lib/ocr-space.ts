/**
 * OCR.space client — the ONE place that talks to the OCR API.
 * Text mode and Menu mode use the same endpoint/key; only parameters differ.
 */

import type { OcrSpaceResponse } from "./menu-segmentation";

const OCR_ENGINE = process.env.OCR_ENGINE ?? "2"; // 2 = more accurate

export interface OcrRequestOptions {
  isTable: boolean;
  isOverlayRequired: boolean;
}

export class OcrError extends Error {
  constructor(
    message: string,
    public code?: "ocr_not_configured" | "ocr_invalid_key",
  ) {
    super(message);
    this.name = "OcrError";
  }
}

/** Raw OCR.space call; returns the full parsed response (incl. overlay). */
export async function ocrSpaceRequest(
  imageBase64: string,
  opts: OcrRequestOptions,
): Promise<OcrSpaceResponse> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    throw new OcrError(
      "OCR_SPACE_API_KEY secret is required for Snapshot OCR. Add it in the Replit Secrets panel.",
      "ocr_not_configured",
    );
  }

  const body = new URLSearchParams({
    base64Image: `data:image/jpeg;base64,${imageBase64}`,
    apikey: apiKey,
    OCREngine: OCR_ENGINE,
    detectOrientation: "true",
    isTable: String(opts.isTable),
    isOverlayRequired: String(opts.isOverlayRequired),
    scale: "true",
  });

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (res.status === 403) {
    throw new OcrError(
      "Your OCR.space API key is invalid or unauthorised. Check the OCR_SPACE_API_KEY secret.",
      "ocr_invalid_key",
    );
  }
  if (!res.ok) {
    throw new OcrError(`OCR.space returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as OcrSpaceResponse;
  assertOcrOk(data);
  return data;
}

/** Validate an OCR.space response; throws structured OcrError, never raw. */
export function assertOcrOk(data: OcrSpaceResponse): void {
  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(" ")
      : (data.ErrorMessage ?? "OCR.space processing error");
    if (/unauthori[sz]ed|invalid.*key|api.*key/i.test(msg)) {
      throw new OcrError(`OCR.space API key error: ${msg}`, "ocr_invalid_key");
    }
    throw new OcrError(msg);
  }
  // OCRExitCode 1 = success, 2 = partially successful, others = failure
  const exitCode = data.OCRExitCode ?? 0;
  if (exitCode !== 1 && exitCode !== 2) {
    throw new OcrError(`OCR.space exited with code ${exitCode}`);
  }
}

/** Concatenate all parsed text (Text mode). */
export function extractParsedText(data: OcrSpaceResponse): string {
  return (data.ParsedResults ?? [])
    .map((r) => r.ParsedText ?? "")
    .join("\n")
    .trim();
}
