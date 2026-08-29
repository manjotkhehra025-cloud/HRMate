import { NextRequest } from "next/server";
import { verifyRegistration } from "@/lib/passkeys";
import { requireUser, unauthorized, error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  try {
    const body = await req.json();
    await verifyRegistration(user.id, body);
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message || "Passkey registration failed", 400);
  }
}
