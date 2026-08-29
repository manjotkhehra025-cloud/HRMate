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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
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
