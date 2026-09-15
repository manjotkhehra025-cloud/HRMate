import { NextRequest } from "next/server";
import { authenticationOptions, storeChallenge } from "@/lib/passkeys";
import { error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const options = await authenticationOptions(req);
    storeChallenge(options.challenge);
    return json(options);
  } catch (e: any) {
    return error(e.message || "Failed to create authentication options", 500);
  }
}
