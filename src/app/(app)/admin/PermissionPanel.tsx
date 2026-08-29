"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, ROLE_LABELS } from "@/lib/permission-constants";

interface Override {
  permission: string;
  granted: number;
}

export default function PermissionPanel({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}) {
  const [user, setUser] = useState<any>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/permissions?userId=${userId}`);
    const data = await res.json();
    setUser(data.user);
    setOverrides(data.overrides);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [userId]);

  function currentState(permission: string): "on" | "off" | "default" {
    const o = overrides.find((x) => x.permission === permission);
    if (!o) return "default";
    return o.granted ? "on" : "off";
  }

  async function toggle(permission: string, state: "on" | "off" | "default") {
    setSaving(permission);
    let granted: boolean | null = null;
    if (state === "on") granted = true;
    else if (state === "off") granted = false;
    // state === "default" -> granted = null (reset to role default)

    await fetch("/api/admin/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, permission, granted }),
    });
    setSaving(null);
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-secondary px-3 py-2 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{user?.name}</h2>
          <p className="text-xs text-slate-400 capitalize">
            {ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role}
          </p>
        </div>
      </div>

      {isSuperAdmin ? (
        <div className="card flex items-center gap-3 p-6">
          <ShieldCheck className="h-8 w-8 text-brand-500" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Super Admin has full access</p>
            <p className="text-xs text-slate-500">
              The super admin automatically has every permission and cannot be restricted.
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Permissions</h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Default</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Granted</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Denied</span>
            </div>
          </div>

          {PERMISSION_GROUPS.map((group) => (
            <div key={group} className="mb-5 last:mb-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
              <div className="space-y-1">
                {ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => {
                  const state = currentState(p.key);
                  return (
                    <div
                      key={p.key}
                      className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-700">{p.label}</span>
                      {saving === p.key ? (
                        <Spinner className="h-4 w-4 text-brand-500" />
                      ) : (
                        <div className="flex gap-1">
                          <ToggleBtn
                            active={state === "off"}
                            color="rose"
                            onClick={() => toggle(p.key, state === "off" ? "default" : "off")}
                            label="Deny"
                          />
                          <ToggleBtn
                            active={state === "on"}
                            color="emerald"
                            onClick={() => toggle(p.key, state === "on" ? "default" : "on")}
                            label="Allow"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  color,
  onClick,
  label,
}: {
  active: boolean;
  color: "rose" | "emerald";
  onClick: () => void;
  label: string;
}) {
  const activeCls =
    color === "rose" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white";
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
        active ? activeCls : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
