import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import db from "@/lib/db";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = getSessionUser();
  if (!user) redirect("/login");

  const perms = getPermissions(user.id);
  const permissionList = perms.isSuperAdmin
    ? ["*"]
    : Array.from(perms.list);

  const unread = (
    db
      .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
      .get(user.id) as { c: number }
  ).c;

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        color: user.color,
        department: user.department,
        designation: user.designation,
        avatar: user.avatar || "",
      }}
      permissions={permissionList}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
