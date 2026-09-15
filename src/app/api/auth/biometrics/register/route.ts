import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const bioToken = randomId("bio_");
  try {
    db.prepare(
      "INSERT INTO device_biometrics (token, user_id, created_at) VALUES (?, ?, ?)"
    ).run(bioToken, user.id, Date.now());
  } catch {
    // ignore
  }

  return json({
    ok: true,
    biometricToken: bioToken,
    email: user.email,
  });
}
