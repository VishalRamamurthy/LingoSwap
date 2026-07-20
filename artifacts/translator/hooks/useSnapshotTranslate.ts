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

export const MenuItemSchema = z.object({
  id: z.string(),
  originalText: z.string(),
  price: z.string().nullable(),
  translatedText: z.string(),
  isSectionHeader: z.boolean(),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

export const MenuResponseSchema = z.object({
  mode: z.literal("menu"),
  items: z.array(MenuItemSchema),
  targetLanguage: z.string(),
  reason: z.enum(["not_a_menu"]).optional(),
});

export type MenuResponse = z.infer<typeof MenuResponseSchema>;

export type SnapshotRequest = {
  image: string; // base64, no data: prefix
  mimeType: "image/jpeg";
  targetLanguage: string;
  sourceLanguage?: string;
  mode?: "text" | "menu";
};

const SESSION_KEY = "lingo-session-token";

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function apiPost(path: string, body: unknown): Promise<unknown> {
  // Read base URL set by _layout.tsx at startup.
  const baseUrl =
    (globalThis as unknown as Record<string, string>).__apiBaseUrl ?? "";

  // Read session token from AsyncStorage (mobile auth path).
  const token = await AsyncStorage.getItem(SESSION_KEY);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });

  const json: unknown = await res.json();

  if (!res.ok) {
    const obj =
      typeof json === "object" && json !== null
        ? (json as { message?: unknown; code?: unknown })
        : {};
    const message =
      typeof obj.message === "string" ? obj.message : "Request failed.";
    const code = typeof obj.code === "string" ? obj.code : undefined;
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    throw error;
  }

  return json;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Text-mode snapshot OCR + translate. */
export function useSnapshotTranslate() {
  return useMutation({
    mutationFn: async (data: SnapshotRequest): Promise<SnapshotResponse> => {
      const json = await apiPost("/api/snapshot/translate", { ...data, mode: "text" });
      return SnapshotResponseSchema.parse(json);
    },
  });
}

/** Menu-mode snapshot OCR + segmentation + batched translate. */
export function useSnapshotMenu() {
  return useMutation({
    mutationFn: async (data: SnapshotRequest): Promise<MenuResponse> => {
      const json = await apiPost("/api/snapshot/translate", { ...data, mode: "menu" });
      return MenuResponseSchema.parse(json);
    },
  });
}

export type MenuRetranslateRequest = {
  items: Pick<MenuItem, "id" | "originalText" | "price" | "isSectionHeader">[];
  targetLanguage: string;
  sourceLanguage?: string;
};

/** Re-translate cached menu items (language change) — no OCR involved. */
export function useMenuRetranslate() {
  return useMutation({
    mutationFn: async (data: MenuRetranslateRequest): Promise<MenuResponse> => {
      const json = await apiPost("/api/snapshot/menu/retranslate", data);
      return MenuResponseSchema.parse(json);
    },
  });
}
