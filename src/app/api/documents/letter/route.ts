import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const letterType = searchParams.get("type") || "bonafide"; // 'bonafide' | 'duty' | 'experience'
    const targetUserId = searchParams.get("userId") || user.id;

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isAdmin && targetUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const target = db
      .prepare(
        `SELECT u.*, s.name as shift_name, s.start_time, s.hours
         FROM users u
         LEFT JOIN shifts s ON u.shift_id = s.id
         WHERE u.id = ?`
      )
      .get(targetUserId) as any;

    if (!target) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const todayStr = formatDate(new Date().toISOString().split("T")[0]);
    const refNumber = `GDF/HR/${new Date().getFullYear()}/${(target.emp_code || target.id).replace(/[^a-zA-Z0-9]/g, "")}`;

    return NextResponse.json({
      ok: true,
      refNumber,
      issuedDate: todayStr,
      employee: {
        id: target.id,
        name: target.name,
        empCode: target.emp_code || "GD" + target.id.substring(2, 8).toUpperCase(),
        department: target.department || "General",
        designation: target.designation || "Staff",
        doj: target.doj || "01 April 2024",
        staffType: target.staff_type || "official",
        shift: target.shift_name || "General Day Shift",
      },
      letterType,
      company: {
        name: "GD Foods Mfg. (I) Pvt. Ltd.",
        brand: "Tops",
        address: "Village Dhunda, Goindwal Road, Khadur Sahib, Tarn Taran, Punjab - 143422",
        hrEmail: "response@tops.in",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
