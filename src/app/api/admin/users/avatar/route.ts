import { NextRequest } from "next/server";
import fs from "fs";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { avatarPath } from "@/lib/avatars";

export const dynamic = "force-dynamic";

function canSetPhoto(actor: { id: string; role: string }, targetId: string) {
  if (!hasPermission(actor.id, "admin.users")) return false;
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(targetId) as
    | { role: string }
    | undefined;
  if (!target) return false;
  if (target.role === "super_admin" && actor.role !== "super_admin") return false;
  return true;
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const form = await req.formData();
  const targetId = String(form.get("user_id") || "");
  if (!targetId) return error("User id required");
  if (!canSetPhoto(user, targetId)) return error("You don't have permission to set this photo", 403);

  const file = form.get("file");
  if (!(file instanceof Blob)) return error("Choose a photo");
  if (file.size > 2_000_000) return error("Photo must be under 2 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(avatarPath(targetId), buf);
  const stamp = String(Date.now());
  db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(stamp, targetId);
  return json({ ok: true, avatar: stamp, user_id: targetId });
}

export async function DELETE(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const targetId = String(body.user_id || "");
  if (!targetId) return error("User id required");
  if (!canSetPhoto(user, targetId)) return error("You don't have permission to set this photo", 403);
  try {
    fs.unlinkSync(avatarPath(targetId));
  } catch {
    /* ignore */
  }
  db.prepare("UPDATE users SET avatar = '' WHERE id = ?").run(targetId);
  return json({ ok: true, avatar: "", user_id: targetId });
}
