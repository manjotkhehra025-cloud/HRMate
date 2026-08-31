"use client";

import { useState, useEffect } from "react";
import { UserCog } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permission-constants";
import PermissionPanel from "./PermissionPanel";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  avatar?: string;
}

export default function PermissionsTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users);
        setLoading(false);
      });
  }, []);

  if (selected) {
    return <PermissionPanel userId={selected} onBack={() => setSelected(null)} />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-[#E8F1FC] p-3 text-[13px] text-[#1E6FE0]">
        Select a user to fine-tune what they can and can&apos;t do. Overrides apply on top of their
        role&apos;s default permissions.
      </div>

      {users.length === 0 ? (
        <EmptyState icon={<UserCog className="h-8 w-8" />} title="No users" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(u.id)}
              className="card flex items-center gap-3 p-4 text-left"
            >
              <Avatar name={u.name} color={u.color} size={48} src={avatarSrc(u.id, u.avatar)} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#172334]">{u.name}</p>
                <p className="truncate text-[12px] text-[#8A97A8]">{u.email}</p>
                <span className="mt-1 inline-block text-[11px] font-semibold text-[#1E6FE0]">
                  {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
