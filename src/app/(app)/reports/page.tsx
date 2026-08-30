import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Reports — HRMate" };

export default function ReportsPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  if (!perms.isSuperAdmin && !perms.has("reports.view")) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">Reports</h1>
        <p className="page-sub">Monthly attendance insights and exports.</p>
      </div>
      <ReportsClient />
    </div>
  );
}
