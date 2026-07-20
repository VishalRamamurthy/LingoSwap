import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SnapshotResponseSchema = z.object({
  detectedText: z.string(),
  detectedLanguage: z.string().optional(),
  translatedText: z.string(),
  targetLanguage: z.string(),
  reason: z.enum(["no_text_found", "low_confidence"]).optional(),
});

export type SnapshotResponse = z.infer<typeof SnapshotResponseSchema>;

export type SnapshotRequest = {
  image: string;       // base64, no data: prefix
  mimeType: "image/jpeg";
  targetLanguage: string;
  sourceLanguage?: string;
};

const SESSION_KEY = "lingo-session-token";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSnapshotTranslate() {
  return useMutation({
    mutationFn: async (data: SnapshotRequest): Promise<SnapshotResponse> => {
      // Read base URL set by _layout.tsx at startup.
      const baseUrl =
        (globalThis as unknown as Record<string, string>).__apiBaseUrl ?? "";

      // Read session token from AsyncStorage (mobile auth path).
      const token = await AsyncStorage.getItem(SESSION_KEY);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}/api/snapshot/translate`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      });

      const json: unknown = await res.json();

      if (!res.ok) {
        const obj =
          typeof json === "object" && json !== null
            ? (json as { message?: unknown; code?: unknown })
            : {};
        const message =
          typeof obj.message === "string"
            ? obj.message
            : "Snapshot translation failed.";
        const code =
          typeof obj.code === "string" ? obj.code : undefined;
        const error = new Error(message) as Error & { code?: string };
        error.code = code;
        throw error;
      }

      return SnapshotResponseSchema.parse(json);
    },
  });
}
