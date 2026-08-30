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
    <div className="space-y-4 pb-2 sm:space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Attendance</h1>
        <p className="mt-1 text-[14px] text-muted">Punch in at the factory, then review your month.</p>
      </div>

      {/* Map first, punch panel right below it — one card, one decision. */}
      <div className="card overflow-hidden">
        <div className="relative">
          <GeofenceMap lat={factory.lat} lng={factory.lng} radius={factory.radius} embedded />
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink shadow-card">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16B878] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16B878]" />
            </span>
            {factory.name} · {factory.radius} m punch zone
          </div>
        </div>
        <div className="border-t border-line bg-slate-50 p-5 sm:p-6">
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
