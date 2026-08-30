import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { getUserPrefs } from "@/lib/prefs";
import { getVapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const USER_COLS =
  "SELECT id, email, name, role, department, designation, phone, color, avatar, staff_type FROM users WHERE id = ?";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const row = db.prepare(USER_COLS).get(user.id) as any;

  const factory = getFactoryConfig();
  return json({
    user: {
      ...row,
      phone: row.phone || "",
      avatar: row.avatar || "",
    },
    factory: {
      name: factory.name,
      lat: factory.lat,
      lng: factory.lng,
      radius: factory.radius,
      address: factory.address,
    },
    prefs: getUserPrefs(user.id),
    canSettings: hasPermission(user.id, "admin.settings"),
    canAdjustLeaves: hasPermission(user.id, "leaves.adjust"),
    vapidPublicKey: getVapidPublicKey(),
  });
}

export async function PUT(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name) return error("Name is required");
  if (name.length > 80) return error("Name is too long");
  if (phone && !/^[+\d][\d\s\-()]{6,20}$/.test(phone)) {
    return error("Enter a valid phone number");
  }

  db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id);
  const row = db.prepare(USER_COLS).get(user.id);

  return json({ ok: true, user: row });
}
