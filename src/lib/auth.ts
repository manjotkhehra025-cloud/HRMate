import { cookies } from "next/headers";
import db from "./db";
import { randomId } from "./crypto";
import { getPermissions } from "./permissions";

export const SESSION_COOKIE = "hrmate_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: IS_PRODUCTION,
};

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  designation: string;
  phone: string;
  color: string;
  active: number;
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = randomId("s_");
  const expiresAt = Date.now() + SESSION_TTL;
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, Date.now(), expiresAt);
  return { token, expiresAt };
}

export function destroySession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSessionUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`
    )
    .get(token, Date.now()) as SessionUser | undefined;
  return row || null;
}

export function getUserById(id: string): SessionUser | null {
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as SessionUser) || null;
}

export function currentPermissions() {
  const user = getSessionUser();
  if (!user) return { has: () => false, list: new Set(), isSuperAdmin: false, user: null };
  return { ...getPermissions(user.id), user };
}
