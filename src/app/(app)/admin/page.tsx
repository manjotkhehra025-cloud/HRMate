import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import AdminClient from "./AdminClient";

export const metadata = { title: "Admin — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <AdminClient
      isSuperAdmin={perms.isSuperAdmin}
      canUsers={has("admin.users")}
      canPermissions={has("admin.permissions")}
      canSettings={has("admin.settings")}
    />
  );
}
