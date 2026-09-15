import { NextRequest } from "next/server";
import { registrationOptions, storeChallenge } from "@/lib/passkeys";
import { requireUser, unauthorized, error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  try {
    const options = await registrationOptions(user.id, req);
    storeChallenge(options.challenge);
    return json(options);
  } catch (e: any) {
    return error(e.message || "Failed to create registration options", 500);
  }
}
