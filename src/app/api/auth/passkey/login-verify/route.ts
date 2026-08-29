import { NextRequest } from "next/server";
import { verifyAuthentication } from "@/lib/passkeys";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await verifyAuthentication(body);
    const res = json({ ok: true });
    res.cookies.set(SESSION_COOKIE, session.token, {
      ...sessionCookieOptions,
      expires: new Date(session.expiresAt),
    });
    return res;
  } catch (e: any) {
    return error(e.message || "Passkey authentication failed", 401);
  }
}
