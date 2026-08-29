import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission, ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.permissions")) {
    return error("You don't have permission to manage permissions", 403);
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return error("userId required");

  const target = db.prepare("SELECT id, name, role FROM users WHERE id = ?").get(userId) as any;
  if (!target) return error("User not found", 404);

  const overrides = db
    .prepare("SELECT permission, granted FROM user_permissions WHERE user_id = ?")
    .all(userId) as { permission: string; granted: number }[];

  return json({ user: target, overrides, all: ALL_PERMISSIONS });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.permissions")) {
    return error("You don't have permission to manage permissions", 403);
  }

  const { userId, permission, granted } = await req.json();
  if (!userId || !permission) return error("userId and permission required");

  if (granted === null || granted === undefined) {
    db.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission = ?").run(
      userId,
      permission
    );
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO user_permissions (user_id, permission, granted) VALUES (?, ?, ?)"
    ).run(userId, permission, granted ? 1 : 0);
  }

  return json({ ok: true });
}
