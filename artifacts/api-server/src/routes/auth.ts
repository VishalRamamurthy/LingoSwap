import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

function safeUser(row: {
  id: number;
  name: string;
  email: string;
  created_at: Date;
}) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

// Look up a session from the Authorization: Bearer header when no cookie session exists.
async function resolveSessionFromBearer(token: string): Promise<number | null> {
  try {
    // connect-pg-simple stores sessions as JSON in the sess column.
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

// ─── signup ─────────────────────────────────────────────────────────────────

router.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ field: "name", message: "Name is required." });
    return;
  }
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ field: "email", message: "A valid email address is required." });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ field: "password", message: "Password must be at least 8 characters." });
    return;
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ field: "email", message: "An account with that email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query<{ id: number; name: string; email: string; created_at: Date }>(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
      [name.trim(), email.toLowerCase().trim(), passwordHash],
    );
    const user = rows[0]!;

    // Create blank profile row
    await pool.query("INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [user.id]);

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    res.status(201).json({ user: safeUser(user), sessionToken: req.sessionID });
  } catch (err) {
    req.log.error({ err }, "Signup failed");
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ─── login ──────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  try {
    const { rows } = await pool.query<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      created_at: Date;
    }>(
      "SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );

    const user = rows[0];
    if (!user) {
      // Constant-time path to avoid timing attacks
      await bcrypt.compare(password, "$2b$12$invalidhashpaddingtostoptimingatk");
      res.status(401).json({ message: "Incorrect email or password." });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ message: "Incorrect email or password." });
      return;
    }

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    res.json({ user: safeUser(user), sessionToken: req.sessionID });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ─── logout ─────────────────────────────────────────────────────────────────

router.post("/auth/logout", async (req, res) => {
  // Destroy cookie session (web path)
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));

  // Also destroy the Bearer-token session (mobile path) if one was presented
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      await pool.query("DELETE FROM sessions WHERE sid = $1", [token]);
    } catch {
      // ignore
    }
  }

  res.clearCookie("sid");
  res.json({ ok: true });
});

// ─── me ─────────────────────────────────────────────────────────────────────

router.get("/auth/me", async (req, res) => {
  let userId = req.session.userId ?? null;

  // Mobile: fallback to Bearer token → session lookup
  if (!userId) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      userId = await resolveSessionFromBearer(auth.slice(7));
    }
  }

  if (!userId) {
    res.status(401).json({ message: "Not authenticated." });
    return;
  }

  try {
    const { rows } = await pool.query<{
      id: number; name: string; email: string; created_at: Date;
      bio: string | null; preferred_source_language: string | null;
      preferred_target_language: string | null;
      translation_count: number; voice_translation_count: number;
    }>(
      `SELECT u.id, u.name, u.email, u.created_at,
              p.bio, p.preferred_source_language, p.preferred_target_language,
              p.translation_count, p.voice_translation_count
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!rows[0]) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }

    const r = rows[0];
    res.json({
      user: safeUser(r),
      profile: {
        bio: r.bio,
        preferredSourceLanguage: r.preferred_source_language,
        preferredTargetLanguage: r.preferred_target_language,
        translationCount: r.translation_count,
        voiceTranslationCount: r.voice_translation_count,
      },
    });
  } catch (err) {
    req.log.error({ err }, "me failed");
    res.status(500).json({ message: "Something went wrong." });
  }
});

// ─── update profile ─────────────────────────────────────────────────────────

router.patch("/auth/profile", async (req, res) => {
  let userId = req.session.userId ?? null;

  if (!userId) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) userId = await resolveSessionFromBearer(auth.slice(7));
  }
  if (!userId) {
    res.status(401).json({ message: "Not authenticated." });
    return;
  }

  const { name, bio, preferredSourceLanguage, preferredTargetLanguage } = req.body as {
    name?: string;
    bio?: string;
    preferredSourceLanguage?: string;
    preferredTargetLanguage?: string;
  };

  try {
    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ field: "name", message: "Name cannot be blank." });
        return;
      }
      await pool.query("UPDATE users SET name = $1 WHERE id = $2", [name.trim(), userId]);
    }

    await pool.query(
      `UPDATE profiles
       SET bio = COALESCE($1, bio),
           preferred_source_language = COALESCE($2, preferred_source_language),
           preferred_target_language = COALESCE($3, preferred_target_language),
           updated_at = NOW()
       WHERE user_id = $4`,
      [bio ?? null, preferredSourceLanguage ?? null, preferredTargetLanguage ?? null, userId],
    );

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "profile update failed");
    res.status(500).json({ message: "Something went wrong." });
  }
});

export default router;
