"use client";

import { useState } from "react";
import { Users, UserCog, Shield, Plus } from "lucide-react";
import UsersTab from "./UsersTab";
import PermissionsTab from "./PermissionsTab";
import { classNames } from "@/lib/utils";

export default function AdminClient({
  isSuperAdmin,
  canUsers,
  canPermissions,
}: {
  isSuperAdmin: boolean;
  canUsers: boolean;
  canPermissions: boolean;
  canSettings?: boolean;
}) {
  const tabs = [
    { key: "users", label: "System Users & Admins", icon: <Shield className="h-4 w-4" />, show: canUsers },
    { key: "employees", label: "Employees & Staff", icon: <Users className="h-4 w-4" />, show: canUsers },
    { key: "permissions", label: "Role Permissions", icon: <UserCog className="h-4 w-4" />, show: canPermissions },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(tabs[0]?.key || "users");

  return (
    <div className="space-y-6">
      {/* Top Header - Always visible on Mobile & Desktop */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            Administration & User Access
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          Manage administrative personnel, operations staff, Yellow Card workers, and granular role permissions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-[14px] bg-[#EEF2F7] p-1" style={{ touchAction: "pan-x" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={classNames(
              "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] px-4 py-2.5 text-[13.5px] font-bold transition",
              tab === t.key ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
            )}
          >
            <span className={tab === t.key ? "text-[#1E6FE0]" : "text-[#8A97A8]"}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "users" ? "" : "hidden"}>
        <UsersTab kind="control" isSuperAdmin={isSuperAdmin} canPermissions={canPermissions} />
      </div>
      <div className={tab === "employees" ? "" : "hidden"}>
        <UsersTab kind="staff" isSuperAdmin={isSuperAdmin} canPermissions={canPermissions} />
      </div>
      <div className={tab === "permissions" ? "" : "hidden"}>
        <PermissionsTab />
      </div>
    </div>
  );
}
