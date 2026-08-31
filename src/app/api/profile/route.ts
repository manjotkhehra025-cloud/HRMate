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
      staff_type: row.staff_type || "official",
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
    canAdjustLeaves: hasPermission(user.id, "leaves.adjust") || user.role === "super_admin",
    canProfileFull: hasPermission(user.id, "profile.full") || user.role === "super_admin",
    vapidPublicKey: getVapidPublicKey(),
  });
}

export async function PUT(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const name = String(body.name !== undefined ? body.name : user.name || "").trim();
  const phone = String(body.phone !== undefined ? body.phone : user.phone || "").trim();
  if (!name) return error("Name is required");
  if (name.length > 80) return error("Name is too long");
  if (phone && !/^[+\d][\d\s\-()]{6,20}$/.test(phone)) {
    return error("Enter a valid phone number");
  }

  const isSuper = user.role === "super_admin";
  const canFull = hasPermission(user.id, "profile.full") || isSuper;

  if (canFull) {
    const email = String(body.email || user.email || "").trim().toLowerCase();
    const department = String(body.department ?? user.department ?? "").trim();
    const designation = String(body.designation ?? user.designation ?? "").trim();
    const staff_type =
      body.staff_type === "yellow_card" || body.staff_type === "official"
        ? body.staff_type
        : user.staff_type || "official";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error("Enter a valid email");
    }
    if (email.length > 120) return error("Email is too long");
    if (department.length > 80) return error("Department is too long");
    if (designation.length > 80) return error("Designation is too long");
    const taken = db
      .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .get(email, user.id) as { id: string } | undefined;
    if (taken) return error("That email is already in use");

    db.prepare(
      "UPDATE users SET name = ?, phone = ?, email = ?, department = ?, designation = ?, staff_type = ? WHERE id = ?"
    ).run(name, phone, email, department, designation, staff_type, user.id);
  } else {
    db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id);
  }
  const row = db.prepare(USER_COLS).get(user.id);

  return json({ ok: true, user: row });
}
