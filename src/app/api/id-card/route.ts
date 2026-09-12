import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { getFactoryConfig } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const targetId = url.searchParams.get("userId") || user.id;

  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.designation, u.phone,
              u.color, u.avatar, u.staff_type, u.emp_code, u.blood_group, u.emergency_contact,
              u.shift_id, u.created_at, s.name as shift_name, s.start_time as shift_time
       FROM users u
       LEFT JOIN shifts s ON s.id = u.shift_id
       WHERE u.id = ?`
    )
    .get(targetId) as any;

  if (!row) return error("Employee record not found", 404);

  const factory = getFactoryConfig();

  // Generated employee ID if not explicitly set
  const empId = row.emp_code || `GDF-${row.id.replace(/\D/g, "").slice(0, 4) || "1024"}`;

  return json({
    user: {
      ...row,
      emp_code: empId,
      blood_group: row.blood_group || "B+",
      emergency_contact: row.emergency_contact || "+91 98765 43210",
      shift_name: row.shift_name || "General Shift",
    },
    factory,
    verifyUrl: `https://gdfoods.duckdns.org/verify?emp=${empId}&uid=${row.id}`,
  });
}

export async function PATCH(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { blood_group, emergency_contact, emp_code, shift_id } = body;

  db.prepare(
    `UPDATE users
     SET blood_group = COALESCE(?, blood_group),
         emergency_contact = COALESCE(?, emergency_contact),
         emp_code = COALESCE(?, emp_code),
         shift_id = COALESCE(?, shift_id)
     WHERE id = ?`
  ).run(
    blood_group || null,
    emergency_contact || null,
    emp_code || null,
    shift_id || null,
    user.id
  );

  return json({ ok: true });
}
