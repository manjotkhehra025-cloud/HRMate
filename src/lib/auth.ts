import { cookies } from "next/headers";
import db from "./db";
import { randomId } from "./crypto";
import { getPermissions } from "./permissions";
import { IDLE_MS } from "./auth-idle";

export { IDLE_MS } from "./auth-idle";

export const SESSION_COOKIE = "hrmate_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.HRMATE_ORIGIN?.startsWith("https://") ?? false,
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
  avatar: string;
  staff_type: string;
  manager_scope: string;
  weekly_off: number;
  active: number;
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = randomId("s_");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL;
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?)"
  ).run(token, userId, now, expiresAt, now);
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
      `SELECT u.*, s.last_seen AS _last_seen, s.created_at AS _sess_created
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`
    )
    .get(token, Date.now()) as
    | (SessionUser & { _last_seen?: number | null; _sess_created?: number })
    | undefined;
  if (!row) return null;

  const last = Number(row._last_seen || row._sess_created || 0);
  if (last && Date.now() - last > IDLE_MS) {
    destroySession(token);
    return null;
  }
  if (!last || Date.now() - last > 15_000) {
    db.prepare("UPDATE sessions SET last_seen = ? WHERE token = ?").run(Date.now(), token);
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    department: row.department,
    designation: row.designation,
    phone: row.phone,
    color: row.color,
    avatar: row.avatar,
    staff_type: row.staff_type,
    manager_scope: row.manager_scope,
    weekly_off: row.weekly_off,
    active: row.active,
  };
}

export function getUserById(id: string): SessionUser | null {
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as SessionUser) || null;
}

export function currentPermissions() {
  const user = getSessionUser();
  if (!user) return { has: () => false, list: new Set(), isSuperAdmin: false, user: null };
  return { ...getPermissions(user.id), user };
}
