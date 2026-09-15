import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import CalendarClient from "./CalendarClient";

export const metadata = { title: "Calendar & Celebrations — HRMate" };
export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  const perms = getPermissions(user.id);
  const canManage = perms.isSuperAdmin || perms.has("leaves.manage" as any) || user.role === "admin";

  return <CalendarClient canManage={canManage} currentUserId={user.id} />;
}
