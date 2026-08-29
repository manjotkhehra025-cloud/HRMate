import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import TeamClient from "./TeamClient";

export const metadata = { title: "Team — HRMate" };

export default function TeamPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">Team</h1>
        <p className="page-sub">
          See who's in today and upcoming approved leaves.
        </p>
      </div>
      <TeamClient
        canViewAttendance={has("attendance.team")}
        canViewLeaves={has("leaves.team")}
      />
    </div>
  );
}
