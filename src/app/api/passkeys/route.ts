import { NextRequest } from "next/server";
import { getUserPasskeys, removePasskey } from "@/lib/passkeys";
import { requireUser, unauthorized, error, json } from "@/lib/api";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  return json({ passkeys: getUserPasskeys(user.id) });
}

export async function DELETE(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const { id } = await req.json();
  try {
    removePasskey(user.id, id);
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message || "Failed to remove passkey", 400);
  }
}
