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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage users, permissions and factory settings.
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
