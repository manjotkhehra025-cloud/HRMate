import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Reports — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ReportsPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  if (!has("reports.view")) {
    return (
      <div className="card p-12 text-center text-[#8A97A8]">
        You do not have permission to view company reports.
      </div>
    );
  }

  return <ReportsClient />;
}
