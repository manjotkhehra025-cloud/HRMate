import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import db from "@/lib/db";
import AttendanceClient from "./AttendanceClient";

export const metadata = { title: "Attendance — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AttendancePage() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <AttendanceClient canManual={has("attendance.manual")} canView={has("attendance.view")} />
  );
}
