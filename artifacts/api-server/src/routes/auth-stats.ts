/**
 * Increment profile translation counters.
 * Called from translate / transcribe routes after a successful translation.
 * Fails silently so it never breaks the main response.
 */
import { pool } from "@workspace/db";
import type { Request } from "express";

export async function incrementTranslationCount(
  req: Request,
  { isVoice = false }: { isVoice?: boolean } = {},
): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) return;
  try {
    if (isVoice) {
      await pool.query(
        `UPDATE profiles
         SET translation_count = translation_count + 1,
             voice_translation_count = voice_translation_count + 1,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
    } else {
      await pool.query(
        `UPDATE profiles
         SET translation_count = translation_count + 1,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
    }
  } catch {
    // silently ignore — stats are non-critical
  }
}
