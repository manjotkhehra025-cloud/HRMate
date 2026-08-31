import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import LeavesClient from "./LeavesClient";

export const metadata = { title: "Leaves — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LeavesPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <LeavesClient
      canApply={has("leaves.apply")}
      canView={has("leaves.view")}
      canAdjust={perms.isSuperAdmin || has("leaves.adjust")}
      staffType={user.staff_type || "official"}
      currentUserId={user.id}
    />
  );
}
