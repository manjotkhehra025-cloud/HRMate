"use client";

import { useState } from "react";
import { Users, ShieldCheck, MapPin, UserCog } from "lucide-react";
import UsersTab from "./UsersTab";
import PermissionsTab from "./PermissionsTab";
import SettingsTab from "./SettingsTab";

export default function AdminClient({
  isSuperAdmin,
  canUsers,
  canPermissions,
  canSettings,
}: {
  isSuperAdmin: boolean;
  canUsers: boolean;
  canPermissions: boolean;
  canSettings: boolean;
}) {
  const tabs = [
    { key: "users", label: "Users", icon: <Users className="h-4 w-4" />, show: canUsers },
    { key: "permissions", label: "Permissions", icon: <UserCog className="h-4 w-4" />, show: canPermissions },
    { key: "settings", label: "Factory Settings", icon: <MapPin className="h-4 w-4" />, show: canSettings },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(tabs[0]?.key || "users");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab isSuperAdmin={isSuperAdmin} canPermissions={canPermissions} />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
