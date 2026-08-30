import { NextRequest } from "next/server";
import fs from "fs";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { avatarPath } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return error("Choose a photo");
  if (file.size > 2_000_000) return error("Photo must be under 2 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(avatarPath(user.id), buf);
  const stamp = String(Date.now());
  db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(stamp, user.id);
  return json({ ok: true, avatar: stamp });
}

export async function DELETE() {
  const user = requireUser();
  if (!user) return unauthorized();
  try {
    fs.unlinkSync(avatarPath(user.id));
  } catch {
    /* ignore */
  }
  db.prepare("UPDATE users SET avatar = '' WHERE id = ?").run(user.id);
  return json({ ok: true, avatar: "" });
}
