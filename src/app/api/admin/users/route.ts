import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId, hashPassword } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { roleDefaults, ROLES } from "@/lib/permissions";
import { DEPARTMENTS, STAFF_CAPS, departmentScope, parseWeeklyOff, type StaffType } from "@/lib/staff";

function counts() {
  const rows = db
    .prepare(
      `SELECT staff_type, COUNT(*) AS c FROM users WHERE active = 1 GROUP BY staff_type`
    )
    .all() as { staff_type: string; c: number }[];
  const yellow = rows.find((r) => r.staff_type === "yellow_card")?.c || 0;
  const official = rows
    .filter((r) => r.staff_type !== "yellow_card")
    .reduce((s, r) => s + r.c, 0);
  const total = yellow + official;
  return { yellow, official, total };
}

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.users")) {
    return error("You don't have permission to manage users", 403);
  }

  const users = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.department, u.designation, u.color, u.active, u.created_at,
        u.staff_type, u.manager_scope, u.weekly_off, u.avatar, u.phone,
        (SELECT COUNT(*) FROM passkey_credentials pc WHERE pc.user_id = u.id) AS passkey_count
       FROM users u ORDER BY u.created_at DESC`
    )
    .all();

  return json({ users, caps: STAFF_CAPS, counts: counts(), departments: DEPARTMENTS });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.users")) {
    return error("You don't have permission to manage users", 403);
  }

  const body = await req.json();
  const { name, email, password, role, department, designation, color } = body;
  const staff_type: StaffType = body.staff_type === "yellow_card" ? "yellow_card" : "official";
  const weekly_off = parseWeeklyOff(body.weekly_off, role === "super_admin" ? 0 : 6);
  const manager_scope =
    role === "manager"
      ? body.manager_scope === "engineering" || body.manager_scope === "operations"
        ? body.manager_scope
        : departmentScope(department || "")
      : "";

  if (!name || !email || !password) return error("Name, email and password are required");
  if (!ROLES.includes(role)) return error("Invalid role");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return error("A user with this email already exists");

  const c = counts();
  if (c.total >= STAFF_CAPS.total) {
    return error(`Staff limit reached (${STAFF_CAPS.total}). Delete unused members first.`);
  }
  if (staff_type === "yellow_card" && c.yellow >= STAFF_CAPS.yellow_card) {
    return error(`Yellow card limit is ${STAFF_CAPS.yellow_card}.`);
  }
  if (staff_type === "official" && c.official >= STAFF_CAPS.official) {
    return error(`Official staff limit is ${STAFF_CAPS.official}.`);
  }

  const id = randomId("u_");
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, department, designation, color, staff_type, manager_scope, weekly_off, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    email,
    hashPassword(password),
    name,
    role,
    department || "",
    designation || "",
    color || "#1E6FE0",
    staff_type,
    manager_scope,
    weekly_off,
    Date.now()
  );

  const stmt = db.prepare(
    "INSERT OR REPLACE INTO user_permissions (user_id, permission, granted) VALUES (?, ?, 1)"
  );
  const defaults = roleDefaults(role);
  for (const p of defaults) {
    if (p !== "*") stmt.run(id, p);
  }

  return json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.users")) {
    return error("You don't have permission to manage users", 403);
  }

  const body = await req.json();
  const { id, name, email, role, department, designation, color, active, password, staff_type, manager_scope, weekly_off } =
    body;
  if (!id) return error("User id required");

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!target) return error("User not found", 404);

  if (target.role === "super_admin" && user.role !== "super_admin") {
    return error("You can't modify the super admin", 403);
  }

  const nextType = staff_type === "yellow_card" || staff_type === "official" ? staff_type : target.staff_type;
  if (nextType !== target.staff_type && active !== 0) {
    const c = counts();
    if (nextType === "yellow_card" && c.yellow >= STAFF_CAPS.yellow_card) {
      return error(`Yellow card limit is ${STAFF_CAPS.yellow_card}.`);
    }
    if (nextType === "official" && c.official >= STAFF_CAPS.official) {
      return error(`Official staff limit is ${STAFF_CAPS.official}.`);
    }
  }

  const nextScope =
    (role ?? target.role) === "manager"
      ? manager_scope === "engineering" || manager_scope === "operations"
        ? manager_scope
        : departmentScope(department ?? target.department)
      : "";

  const nextOff =
    weekly_off === undefined || weekly_off === null
      ? target.weekly_off ?? 6
      : parseWeeklyOff(weekly_off, target.weekly_off ?? 6);

  db.prepare(
    `UPDATE users SET name = ?, email = ?, role = ?, department = ?, designation = ?, color = ?, active = ?, staff_type = ?, manager_scope = ?, weekly_off = ? WHERE id = ?`
  ).run(
    name ?? target.name,
    email ?? target.email,
    role ?? target.role,
    department ?? target.department,
    designation ?? target.designation,
    color ?? target.color,
    active !== undefined ? (active ? 1 : 0) : target.active,
    nextType,
    nextScope,
    nextOff,
    id
  );

  if (password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
  }

  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (user.role !== "super_admin") {
    return error("Only Super Admin can delete staff", 403);
  }
  const { id } = await req.json();
  if (!id) return error("User id required");
  if (id === user.id) return error("You can't delete your own account");
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!target) return error("User not found", 404);
  if (target.role === "super_admin") {
    const n = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin' AND active = 1").get() as {
      c: number;
    };
    if (n.c <= 1) return error("Cannot delete the last Super Admin");
  }
  const wipe = db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM user_permissions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM passkey_credentials WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM user_prefs WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  });
  wipe();
  return json({ ok: true });
}
