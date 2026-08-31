import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import ApprovalsClient from "./ApprovalsClient";

export const metadata = { title: "Approvals — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ApprovalsPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return <ApprovalsClient canManage={has("approvals.manage")} />;
}
