import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { dateKey } from "@/lib/api";

export const dynamic = "force-dynamic";

// Bridge API Key
const BRIDGE_API_KEY = process.env.HRMATE_BRIDGE_API_KEY || "hrmate_flavorflow_bridge_secret_2026";

// Standard CORS Headers for cross-origin integration (FlavorFlow Web/App)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-api-key");
    const queryKey = req.nextUrl.searchParams.get("apiKey") || req.nextUrl.searchParams.get("api_key");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || customHeader || queryKey;

    if (!token || token !== BRIDGE_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Invalid or missing API key." },
        { status: 401, headers: corsHeaders }
      );
    }

    const requestedDate = req.nextUrl.searchParams.get("date") || dateKey();

    // 1. Total Active Workers
    const activeStaff = db
      .prepare(`SELECT id, name, department, designation, staff_type FROM users WHERE active = 1`)
      .all() as Array<{ id: string; name: string; department: string; designation: string; staff_type: string }>;

    const totalActive = activeStaff.length;

    // 2. Punches for the requested date
    const attendanceRecords = db
      .prepare(
        `SELECT a.user_id, a.punch_in_at, a.punch_out_at, a.punch_in_geofence,
                u.department, u.staff_type
         FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE a.date = ? AND u.active = 1`
      )
      .all(requestedDate) as Array<{
        user_id: string;
        punch_in_at: number;
        punch_out_at: number | null;
        punch_in_geofence: number;
        department: string;
        staff_type: string;
      }>;

    // 3. Approved Leaves for requested date
    const leavesToday = db
      .prepare(
        `SELECT lr.user_id, u.department
         FROM leave_requests lr
         JOIN users u ON u.id = lr.user_id
         WHERE lr.status = 'approved' AND ? >= lr.start_date AND ? <= lr.end_date AND u.active = 1`
      )
      .all(requestedDate, requestedDate) as Array<{ user_id: string; department: string }>;

    const presentCount = attendanceRecords.length;
    const onLeaveCount = leavesToday.length;
    const absentCount = Math.max(0, totalActive - presentCount - onLeaveCount);

    // 4. Department-wise breakdown
    const deptMap: Record<string, { total: number; present: number; onLeave: number; absent: number }> = {};

    for (const staff of activeStaff) {
      const dept = staff.department || "General";
      if (!deptMap[dept]) {
        deptMap[dept] = { total: 0, present: 0, onLeave: 0, absent: 0 };
      }
      deptMap[dept].total++;
    }

    for (const rec of attendanceRecords) {
      const dept = rec.department || "General";
      if (deptMap[dept]) {
        deptMap[dept].present++;
      }
    }

    for (const l of leavesToday) {
      const dept = l.department || "General";
      if (deptMap[dept]) {
        deptMap[dept].onLeave++;
      }
    }

    for (const dept in deptMap) {
      deptMap[dept].absent = Math.max(
        0,
        deptMap[dept].total - deptMap[dept].present - deptMap[dept].onLeave
      );
    }

    const byDepartment: Record<string, { total: number; present: number; onLeave: number; absent: number }> = {};
    for (const dept in deptMap) {
      byDepartment[dept] = deptMap[dept];
    }

    return NextResponse.json(
      {
        ok: true,
        service: "HRMate Workforce Gateway",
        date: requestedDate,
        present: presentCount,
        absent: absentCount,
        onLeave: onLeaveCount,
        totalActive: totalActive,
        attendanceRatePct: totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 100,
        summary: {
          total_active: totalActive,
          present: presentCount,
          absent: absentCount,
          on_leave: onLeaveCount,
          attendance_rate_pct: totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 100,
        },
        byDepartment,
        timestamp: Date.now(),
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
