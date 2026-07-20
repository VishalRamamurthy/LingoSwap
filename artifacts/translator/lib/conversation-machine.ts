/**
 * Pure conversation-mode logic: state machine, translation memo cache, and
 * a turn runner with injected clients. NO react, NO network — unit-testable
 * with node:test, and call counts are assertable with mocked deps.
 */

export type ConversationSide = "top" | "bottom";

export type ConversationPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "translating"
  | "speaking";

export type ConversationEvent =
  | { type: "START_RECORDING"; side: ConversationSide }
  | { type: "STOP_RECORDING" }
  | { type: "TRANSCRIBED" }
  | { type: "TRANSLATED" }
  | { type: "SPOKEN" }
  | { type: "ERROR" }
  | { type: "CANCEL" };

export interface ConversationState {
  phase: ConversationPhase;
  activeSide: ConversationSide | null;
}

export const IDLE_STATE: ConversationState = { phase: "idle", activeSide: null };

/**
 * Explicit transition table. Returns the next state, or `null` when the
 * event is illegal in the current phase (e.g. starting a recording while
 * speaking) — callers must treat `null` as "ignore the tap".
 */
export function transition(
  state: ConversationState,
  event: ConversationEvent,
): ConversationState | null {
  switch (event.type) {
    case "START_RECORDING":
      if (state.phase !== "idle") return null;
      return { phase: "recording", activeSide: event.side };
    case "STOP_RECORDING":
      if (state.phase !== "recording") return null;
      return { phase: "transcribing", activeSide: state.activeSide };
    case "TRANSCRIBED":
      if (state.phase !== "transcribing") return null;
      return { phase: "translating", activeSide: state.activeSide };
    case "TRANSLATED":
      if (state.phase !== "translating") return null;
      return { phase: "speaking", activeSide: state.activeSide };
    case "SPOKEN":
      if (state.phase !== "speaking") return null;
      return IDLE_STATE;
    case "ERROR":
    case "CANCEL":
      // Always legal — abort back to idle from any phase.
      return IDLE_STATE;
  }
}

// ---------------------------------------------------------------------------
// Session-scoped translation memo cache
// ---------------------------------------------------------------------------

export class TranslationCache {
  private map = new Map<string, string>();

  private key(text: string, source: string, target: string): string {
    return `${source}\u0000${target}\u0000${text.trim().toLowerCase()}`;
  }

  get(text: string, source: string, target: string): string | undefined {
    return this.map.get(this.key(text, source, target));
  }

  set(text: string, source: string, target: string, translated: string): void {
    this.map.set(this.key(text, source, target), translated);
  }
}

// ---------------------------------------------------------------------------
// Turn runner with injected clients
// ---------------------------------------------------------------------------

export interface ConversationTurnDeps {
  transcribe: (audioBase64: string) => Promise<string>;
  translate: (text: string, sourceLang: string, targetLang: string) => Promise<string>;
  cache: TranslationCache;
}

export interface ConversationTurnResult {
  original: string;
  translated: string;
  fromCache: boolean;
}

/**
 * One conversation turn: exactly 1 transcription call and at most 1
 * translation call (0 when the identical text/lang pair was already
 * translated this session).
 */
export async function runConversationTurn(
  deps: ConversationTurnDeps,
  audioBase64: string,
  sourceLang: string,
  targetLang: string,
): Promise<ConversationTurnResult> {
  const original = await deps.transcribe(audioBase64);

  const cached = deps.cache.get(original, sourceLang, targetLang);
  if (cached !== undefined) {
    return { original, translated: cached, fromCache: true };
  }

  const translated = await deps.translate(original, sourceLang, targetLang);
  deps.cache.set(original, sourceLang, targetLang, translated);
  return { original, translated, fromCache: false };
}
