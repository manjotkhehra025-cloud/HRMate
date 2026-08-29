import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getFactoryConfig, setFactoryConfig } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.settings") && !hasPermission(user.id, "admin.view")) {
    return error("You don't have permission to view settings", 403);
  }

  const stats = {
    users: (db.prepare("SELECT COUNT(*) AS c FROM users WHERE active = 1").get() as any).c,
    leaveTypes: (db.prepare("SELECT COUNT(*) AS c FROM leave_types").get() as any).c,
  };

  const leaveTypes = db.prepare("SELECT * FROM leave_types ORDER BY sort").all();

  return json({ factory: getFactoryConfig(), stats, leaveTypes });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.settings")) {
    return error("You don't have permission to update settings", 403);
  }

  const { factory, leaveTypes } = await req.json();

  try {
    if (factory) {
      const lat = parseFloat(factory.lat);
      const lng = parseFloat(factory.lng);
      const radius = parseFloat(factory.radius);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return error("Latitude and longitude must be valid numbers");
      }
      if (!Number.isFinite(radius) || radius <= 0) {
        return error("Geofence radius must be a positive number");
      }
      setFactoryConfig({
        name: String(factory.name || "").trim() || "Factory",
        lat,
        lng,
        radius,
        address: String(factory.address || ""),
        workStart: factory.workStart || "09:00",
        workEnd: factory.workEnd || "18:00",
      });
    }

    if (leaveTypes && Array.isArray(leaveTypes)) {
      const stmt = db.prepare(
        "UPDATE leave_types SET name = ?, days_per_year = ?, color = ?, sort = ? WHERE id = ?"
      );
      const tx = db.transaction(() => {
        for (const lt of leaveTypes) {
          stmt.run(lt.name, lt.days_per_year, lt.color, lt.sort, lt.id);
        }
      });
      tx();
    }
  } catch (e: any) {
    return error(e?.message || "Failed to save settings", 500);
  }

  return json({ ok: true, factory: getFactoryConfig() });
}
