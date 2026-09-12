import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { getFactoryConfig, setFactoryConfig } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const isSuperAdmin = user.role === "super_admin" || user.role === "admin";
  const targetId = (isSuperAdmin && url.searchParams.get("userId")) ? url.searchParams.get("userId")! : user.id;

  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.designation, u.phone,
              u.color, u.avatar, u.staff_type, u.emp_code, u.blood_group, u.emergency_contact,
              u.doj, u.dob, u.shift_id, u.created_at, s.name as shift_name, s.start_time as shift_time
       FROM users u
       LEFT JOIN shifts s ON s.id = u.shift_id
       WHERE u.id = ?`
    )
    .get(targetId) as any;

  if (!row) return error("Employee record not found", 404);

  const factory = getFactoryConfig();

  // Retrieve office & brand settings
  const officeSettingsRows = db.prepare(
    "SELECT key, value FROM settings WHERE key IN ('brand_name', 'office_address', 'office_phone', 'office_email')"
  ).all() as { key: string; value: string }[];
  const settingsMap: Record<string, string> = {};
  for (const r of officeSettingsRows) settingsMap[r.key] = r.value;

  const brandName = settingsMap.brand_name || "Tops";
  const officeAddress =
    settingsMap.office_address ||
    "4th Floor, Novotel City Centre Hotel, Plot No. 1 Community Centre, DB Gupta Road, Motia Khan Jhandewalan, New Delhi -110055";
  const officePhone = settingsMap.office_phone || "+91-11-45233333";
  const officeEmail = settingsMap.office_email || "response@tops.in";

  const empId = row.emp_code || `NS${String(row.id.replace(/\D/g, "")).padStart(6, "0") || "000001"}`;

  // If Super Admin, also fetch list of active employees
  let allUsers: any[] = [];
  if (isSuperAdmin) {
    allUsers = db.prepare(
      "SELECT id, name, emp_code, department, designation, role, avatar, color FROM users WHERE active = 1 ORDER BY name ASC"
    ).all();
  }

  return json({
    user: {
      ...row,
      emp_code: empId,
      blood_group: row.blood_group || "A+",
      emergency_contact: row.emergency_contact || "+91 95016 06877",
      doj: row.doj || "27 June 2013",
      dob: row.dob || "03 March 1974",
      shift_name: row.shift_name || "General Day Shift",
    },
    company: {
      brandName,
      factoryName: factory.name || "G.D. Foods Mfg. (I) Pvt. Ltd.",
      factoryAddress: factory.address || "Khadur Sahib, Khadur Sahib Tahsil, Tarn Taran, Punjab, 143117, India",
      officeAddress,
      officePhone,
      officeEmail,
    },
    isSuperAdmin,
    allUsers,
    verifyUrl: `https://gdfoods.duckdns.org/id-card?emp=${empId}&id=${row.id}`,
  });
}

export async function PATCH(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const isSuperAdmin = user.role === "super_admin" || user.role === "admin";

  const body = await req.json();
  const targetUserId = (isSuperAdmin && body.user_id) ? body.user_id : user.id;

  const {
    name,
    emp_code,
    department,
    designation,
    blood_group,
    emergency_contact,
    doj,
    dob,
    shift_id,
    factory_name,
    factory_address,
    office_address,
    office_phone,
    office_email,
  } = body;

  if (isSuperAdmin) {
    db.prepare(
      `UPDATE users
       SET name = COALESCE(?, name),
           emp_code = COALESCE(?, emp_code),
           department = COALESCE(?, department),
           designation = COALESCE(?, designation),
           blood_group = COALESCE(?, blood_group),
           emergency_contact = COALESCE(?, emergency_contact),
           doj = COALESCE(?, doj),
           dob = COALESCE(?, dob),
           shift_id = COALESCE(?, shift_id)
       WHERE id = ?`
    ).run(
      name || null,
      emp_code || null,
      department || null,
      designation || null,
      blood_group || null,
      emergency_contact || null,
      doj || null,
      dob || null,
      shift_id || null,
      targetUserId
    );

    // Save company addresses if provided
    if (factory_name || factory_address) {
      setFactoryConfig({
        name: factory_name,
        address: factory_address,
      });
    }

    const setSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    if (office_address) setSetting.run("office_address", office_address);
    if (office_phone) setSetting.run("office_phone", office_phone);
    if (office_email) setSetting.run("office_email", office_email);
  } else {
    // Non-admin can only update their personal emergency contact & blood group
    db.prepare(
      `UPDATE users
       SET blood_group = COALESCE(?, blood_group),
           emergency_contact = COALESCE(?, emergency_contact)
       WHERE id = ?`
    ).run(blood_group || null, emergency_contact || null, user.id);
  }

  return json({ ok: true });
}
