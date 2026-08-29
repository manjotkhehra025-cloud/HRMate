import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId, hashPassword } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { roleDefaults, ROLES } from "@/lib/permissions";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.users")) {
    return error("You don't have permission to manage users", 403);
  }

  const users = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.department, u.designation, u.color, u.active, u.created_at,
        (SELECT COUNT(*) FROM passkey_credentials pc WHERE pc.user_id = u.id) AS passkey_count
       FROM users u ORDER BY u.created_at DESC`
    )
    .all();

  return json({ users });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.users")) {
    return error("You don't have permission to manage users", 403);
  }

  const { name, email, password, role, department, designation, color } = await req.json();
  if (!name || !email || !password) return error("Name, email and password are required");
  if (!ROLES.includes(role)) return error("Invalid role");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return error("A user with this email already exists");

  const id = randomId("u_");
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, department, designation, color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    email,
    hashPassword(password),
    name,
    role,
    department || "",
    designation || "",
    color || "#6366f1",
    Date.now()
  );

  // Apply role defaults as explicit overrides (so admins can tweak)
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

  const { id, name, email, role, department, designation, color, active, password } =
    await req.json();
  if (!id) return error("User id required");

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!target) return error("User not found", 404);

  // Super admin can't be edited by others (unless self, but keep simple)
  if (target.role === "super_admin" && user.role !== "super_admin") {
    return error("You can't modify the super admin", 403);
  }

  db.prepare(
    `UPDATE users SET name = ?, email = ?, role = ?, department = ?, designation = ?, color = ?, active = ? WHERE id = ?`
  ).run(
    name ?? target.name,
    email ?? target.email,
    role ?? target.role,
    department ?? target.department,
    designation ?? target.designation,
    color ?? target.color,
    active !== undefined ? (active ? 1 : 0) : target.active,
    id
  );

  if (password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
  }

  return json({ ok: true });
}
