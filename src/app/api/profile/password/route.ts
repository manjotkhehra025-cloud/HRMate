import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return error("Current and new password are required");
  }
  if (String(newPassword).length < 8) {
    return error("New password must be at least 8 characters");
  }
  if (currentPassword === newPassword) {
    return error("New password must be different from the current one");
  }

  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as {
    password_hash: string;
  };
  if (!row?.password_hash || !verifyPassword(String(currentPassword), row.password_hash)) {
    return error("Current password is incorrect", 401);
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hashPassword(String(newPassword)),
    user.id
  );
  return json({ ok: true });
}
