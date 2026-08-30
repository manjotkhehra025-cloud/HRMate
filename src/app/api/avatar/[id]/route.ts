import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { avatarPath } from "@/lib/avatars";
import { requireUser, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireUser();
  if (!user) return unauthorized();
  const file = avatarPath(params.id);
  if (!fs.existsSync(file)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const buf = fs.readFileSync(file);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
