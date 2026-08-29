import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import ApprovalsClient from "./ApprovalsClient";

export const metadata = { title: "Approvals — HRMate" };

export default function ApprovalsPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">Approvals</h1>
        <p className="page-sub">
          Review leave and manual punch requests from your team.
        </p>
      </div>
      <ApprovalsClient canManage={has("approvals.manage")} />
    </div>
  );
}
