import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import db from "@/lib/db";
import PunchWidget from "@/components/PunchWidget";
import AttendanceClient from "./AttendanceClient";

export const metadata = { title: "Attendance — HRMate" };

export default function AttendancePage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  const today = dateKey();
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;
  const factory = getFactoryConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          GPS-based punch in and out. You must be within {factory.radius}m of {factory.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PunchWidget canPunch={has("attendance.punch")} today={record} factory={factory} />
        </div>
        <div className="lg:col-span-2">
          <AttendanceClient
            canManual={has("attendance.manual")}
            canView={has("attendance.view")}
          />
        </div>
      </div>
    </div>
  );
}
