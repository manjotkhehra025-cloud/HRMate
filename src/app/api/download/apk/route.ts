import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const candidates = [
      path.join(process.cwd(), "public", "hrmate.apk"),
      path.join(process.cwd(), "public", "app-release.apk"),
      path.join(process.cwd(), "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
      path.join(process.cwd(), "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        const fileBuffer = fs.readFileSync(p);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Disposition": 'attachment; filename="HRMate.apk"',
            "Content-Length": String(stat.size),
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    // If local APK file is not yet built into public/, provide downloadable link or instruct build
    const githubReleaseUrl = "https://github.com/manjotkhehra025-cloud/HRMate/releases/latest/download/app-release.apk";
    return NextResponse.redirect(githubReleaseUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
