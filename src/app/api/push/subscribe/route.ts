import { NextRequest } from "next/server";
import { saveSubscription, removeSubscription } from "@/lib/push";
import { requireUser, unauthorized, json, error } from "@/lib/api";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const body = await req.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return error("Invalid subscription", 400);
  }
  saveSubscription(user.id, body);
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const { endpoint } = await req.json();
  removeSubscription(user.id, endpoint);
  return json({ ok: true });
}
