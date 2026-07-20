import type { RequestHandler } from "express";
import { pool } from "@workspace/db";

async function resolveSessionFromBearer(token: string): Promise<number | null> {
  try {
    const { rows } = await pool.query<{ sess: { userId?: number } }>(
      "SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()",
      [token],
    );
    if (!rows[0]?.sess?.userId) return null;
    return rows[0].sess.userId;
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  let userId = req.session.userId ?? null;

  if (!userId) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      userId = await resolveSessionFromBearer(auth.slice(7));
      if (userId) req.session.userId = userId;
    }
  }

  if (!userId) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  next();
};
