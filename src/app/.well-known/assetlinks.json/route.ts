import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Read SHA256 fingerprints from settings or use default
  const row = db.prepare("SELECT value FROM settings WHERE key = 'assetlinks_sha256'").get() as { value?: string } | undefined;
  const fingerprints = row?.value
    ? row.value.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        // Default placeholder or Play Store signing fingerprint
        "14:6D:E9:01:07:46:3E:CE:21:2F:4E:86:4B:0F:8B:0A:0E:9B:43:77:4A:E8:4A:37:F9:96:A8:B4:4D:2E:8D:67"
      ];

  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.gdfoods.hrmate",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(assetlinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
