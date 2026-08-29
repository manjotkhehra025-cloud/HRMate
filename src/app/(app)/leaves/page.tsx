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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leaves</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your balances, apply for leave and track approvals.
        </p>
      </div>
      <LeavesClient
        canApply={has("leaves.apply")}
        canView={has("leaves.view")}
      />
    </div>
  );
}
