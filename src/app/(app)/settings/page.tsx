import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { getVapidPublicKey } from "@/lib/push";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings — HRMate" };

export default function SettingsPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const factory = getFactoryConfig();

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Display, notifications, leave, shifts and attendance area.</p>
      </div>
      <SettingsClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          designation: user.designation,
          phone: user.phone || "",
          color: user.color,
          avatar: user.avatar || "",
        }}
        canSettings={perms.isSuperAdmin || perms.has("admin.settings")}
        vapidPublicKey={getVapidPublicKey()}
        factoryName={factory.name}
      />
    </div>
  );
}
