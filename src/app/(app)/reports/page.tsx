import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Reports — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ReportsPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  if (!perms.isSuperAdmin && !perms.has("reports.view")) redirect("/dashboard");
  return <ReportsClient />;
}
