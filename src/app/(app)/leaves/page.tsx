import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import LeavesClient from "./LeavesClient";

export const metadata = { title: "Leaves — HRMate" };

export default function LeavesPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">Leaves</h1>
        <p className="page-sub">
          View your balances, apply for leave and track approvals.
        </p>
      </div>
      <LeavesClient
        canApply={has("leaves.apply")}
        canView={has("leaves.view")}
        staffType={user.staff_type || "official"}
      />
    </div>
  );
}
