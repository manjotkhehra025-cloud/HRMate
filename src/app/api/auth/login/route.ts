import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return error("Email and password are required");

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return error("Invalid email or password", 401);
  }
  if (!user.active) return error("Your account is deactivated", 403);

  const session = createSession(user.id);
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.token, {
    ...sessionCookieOptions,
    expires: new Date(session.expiresAt),
  });
  return res;
}
