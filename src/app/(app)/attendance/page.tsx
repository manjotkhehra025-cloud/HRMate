import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import db from "@/lib/db";
import PunchWidget from "@/components/PunchWidget";
import GeofenceMap from "@/components/GeofenceMap";
import AttendanceClient from "./AttendanceClient";

export const metadata = { title: "Attendance — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AttendancePage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  const today = dateKey();
  const record = db
    .prepare(
      `SELECT a.*, s.name AS shift_name, s.start_time AS shift_start, s.hours AS shift_hours
       FROM attendance a LEFT JOIN shifts s ON s.id = a.shift_id
       WHERE a.user_id = ? AND a.date = ?`
    )
    .get(user.id, today) as any;
  const factory = getFactoryConfig();

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">Attendance</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">
          Punch in at the factory, then review your month.
        </p>
      </div>

      <div className="card overflow-hidden">
        <GeofenceMap lat={factory.lat} lng={factory.lng} radius={factory.radius} embedded />
        <div className="p-5 sm:p-6">
          <PunchWidget canPunch={has("attendance.punch")} today={record} factory={factory} variant="flush" />
        </div>
      </div>

      <AttendanceClient
        canManual={has("attendance.manual")}
        canView={has("attendance.view")}
        workStart={factory.workStart}
      />
    </div>
  );
}
