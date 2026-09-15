import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { avatarPath } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
