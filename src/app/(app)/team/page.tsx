import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import TeamClient from "./TeamClient";

export const metadata = { title: "Team — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TeamPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <TeamClient
      canViewAttendance={has("attendance.team")}
      canViewLeaves={has("leaves.team")}
      canEditWeeklyOff={has("admin.users") || user.role === "manager"}
      viewerRole={user.role}
      viewerScope={user.manager_scope || ""}
    />
  );
}
