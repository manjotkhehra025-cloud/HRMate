import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import AdminClient from "./AdminClient";

export const metadata = { title: "Admin — HRMate" };

export default function AdminPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-sub">
          Users are Super Admin, Admin and Manager. Official and yellow-card staff live under Employees.
        </p>
      </div>
      <AdminClient
        isSuperAdmin={perms.isSuperAdmin}
        canUsers={has("admin.users")}
        canPermissions={has("admin.permissions")}
        canSettings={has("admin.settings")}
      />
    </div>
  );
}
