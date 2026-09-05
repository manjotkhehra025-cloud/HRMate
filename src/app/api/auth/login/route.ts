import { NextRequest } from "next/server";
import db from "@/lib/db";
import { verifyPassword, randomId } from "@/lib/crypto";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, biometricToken } = body;

  if (!email) return error("Email is required");

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanEmail) as any;
  if (!user) {
    return error("Invalid email or password", 401);
  }
  if (!user.active) return error("Your account is deactivated", 403);

  // 1. Biometric Token Quick Login
  if (biometricToken) {
    const bioMatch = db.prepare(
      "SELECT * FROM device_biometrics WHERE token = ? AND user_id = ?"
    ).get(biometricToken, user.id) as any;

    const sessionMatch = !bioMatch
      ? db.prepare(
          "SELECT * FROM sessions WHERE token = ? AND user_id = ? AND expires_at > ?"
        ).get(biometricToken, user.id, Date.now()) as any
      : null;

    if (bioMatch || sessionMatch) {
      const newSession = createSession(user.id);
      const res = json({
        ok: true,
        biometricToken,
        user: { name: user.name, email: user.email },
      });
      res.cookies.set(SESSION_COOKIE, newSession.token, {
        ...sessionCookieOptions,
        expires: new Date(newSession.expiresAt),
      });
      return res;
    }
  }

  // 2. Password Login
  if (!password || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return error("Invalid email or password", 401);
  }

  // Create or refresh persistent biometric token for this device
  const bioToken = randomId("bio_");
  try {
    db.prepare(
      "INSERT INTO device_biometrics (token, user_id, created_at) VALUES (?, ?, ?)"
    ).run(bioToken, user.id, Date.now());
  } catch {
    // ignore
  }

  const session = createSession(user.id);
  const res = json({
    ok: true,
    biometricToken: bioToken,
    user: { name: user.name, email: user.email },
  });
  res.cookies.set(SESSION_COOKIE, session.token, {
    ...sessionCookieOptions,
    expires: new Date(session.expiresAt),
  });
  return res;
}
