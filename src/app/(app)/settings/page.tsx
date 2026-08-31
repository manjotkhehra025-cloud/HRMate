import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { getVapidPublicKey } from "@/lib/push";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const factory = getFactoryConfig();

  return (
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
      canProfileFull={perms.isSuperAdmin || perms.has("profile.full")}
      vapidPublicKey={getVapidPublicKey()}
      factoryName={factory.name}
    />
  );
}
