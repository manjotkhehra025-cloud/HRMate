import type { Metadata } from "next";
import db from "@/lib/db";
import VerifyView from "./VerifyView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Employee Verification | G.D. Foods",
  description: "Official Employee Verification Record for G.D. Foods Mfg. (I) Pvt. Ltd.",
};

function getVerifiedUserData(identifier: string) {
  const clean = decodeURIComponent(identifier || "").trim();
  if (!clean) return null;

  let user = db
    .prepare(
      `SELECT id, name, email, role, department, designation, phone, color, avatar,
              staff_type, emp_code, blood_group, emergency_contact, doj, dob, active, created_at
       FROM users
       WHERE LOWER(emp_code) = LOWER(?) OR id = ? OR LOWER(email) = LOWER(?)
       LIMIT 1`
    )
    .get(clean, clean, clean) as any;

  if (!user) {
    const all = db.prepare("SELECT * FROM users").all() as any[];
    user = all.find((u) => {
      const code = (u.emp_code || `NS${String(u.id.replace(/\D/g, "")).padStart(6, "0") || "000001"}`).toLowerCase();
      return code === clean.toLowerCase() || u.id.toLowerCase() === clean.toLowerCase();
    });
  }

  if (!user) return null;

  const settingsRows = db
    .prepare(
      "SELECT key, value FROM settings WHERE key IN ('factory_name', 'factory_address', 'brand_name', 'office_address', 'office_phone', 'office_email')"
    )
    .all() as { key: string; value: string }[];

  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows) settingsMap[r.key] = r.value;

  const empId = user.emp_code || `NS${String(user.id.replace(/\D/g, "")).padStart(6, "0") || "000001"}`;

  return {
    user: {
      ...user,
      emp_code: empId,
      staff_type: user.staff_type || "official",
      blood_group: user.blood_group || "A+",
      emergency_contact: user.emergency_contact || "+91 99148 50317",
      doj: user.doj || "27 June 2013",
      dob: user.dob || "03 March 1974",
    },
    company: {
      brandName: settingsMap.brand_name || "Tops",
      factoryName: settingsMap.factory_name || "GD Foods Mfg. (I) Pvt. Ltd.",
      factoryAddress: settingsMap.factory_address || "Khadur Sahib, Khadur Sahib Tahsil, Tarn Taran, Punjab, 143117, India",
      officeAddress:
        settingsMap.office_address ||
        "4th Floor, Novotel City Centre Hotel, Plot No. 1 Community Centre, DB Gupta Road, Motia Khan Jhandewalan, New Delhi -110055",
      officePhone: settingsMap.office_phone || "+91-11-45233333",
      officeEmail: settingsMap.office_email || "response@tops.in",
    },
  };
}

export default function VerifySearchPage({
  searchParams,
}: {
  searchParams: { emp?: string; id?: string; code?: string };
}) {
  const code = searchParams.emp || searchParams.id || searchParams.code || "";
  const data = getVerifiedUserData(code);

  return <VerifyView data={data} code={code} />;
}
