import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getFactoryConfig, setFactoryConfig } from "@/lib/geo";

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

  if (factory) {
    setFactoryConfig({
      name: factory.name,
      lat: parseFloat(factory.lat),
      lng: parseFloat(factory.lng),
      radius: parseFloat(factory.radius),
      address: factory.address,
      workStart: factory.workStart,
      workEnd: factory.workEnd,
    });
  }

  if (leaveTypes && Array.isArray(leaveTypes)) {
    const stmt = db.prepare(
      "UPDATE leave_types SET name = ?, days_per_year = ?, color = ?, sort = ? WHERE id = ?"
    );
    for (const lt of leaveTypes) {
      stmt.run(lt.name, lt.days_per_year, lt.color, lt.sort, lt.id);
    }
  }

  return json({ ok: true });
}
