"use client";

import { useState, useEffect } from "react";
import { Plus, X, Fingerprint, UserCog } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Spinner, StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permission-constants";
import PermissionPanel from "./PermissionPanel";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
  color: string;
  active: number;
  passkey_count: number;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "#6366f1",
  admin: "#8b5cf6",
  manager: "#0ea5e9",
  employee: "#10b981",
};

export default function UsersTab({
  isSuperAdmin,
  canPermissions,
}: {
  isSuperAdmin: boolean;
  canPermissions: boolean;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<(User & { password?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [managePermsFor, setManagePermsFor] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    department: "",
    designation: "",
  });

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ name: "", email: "", password: "", role: "employee", department: "", designation: "" });
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      setMessage("User created ✓");
      setShowForm(false);
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update user");
        return;
      }
      setMessage("User updated ✓");
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, active: u.active ? 0 : 1 }),
    });
    load();
  }

  if (managePermsFor) {
    return (
      <PermissionPanel
        userId={managePermsFor}
        onBack={() => setManagePermsFor(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Team members <span className="text-slate-400">({users.length})</span>
        </h2>
        <button onClick={() => { setShowForm(true); resetForm(); }} className="btn-primary px-3 py-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add user
        </button>
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      {showForm && (
        <form onSubmit={createUser} className="card space-y-4 p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">New user</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Production" />
            </div>
            <div>
              <label className="label">Designation</label>
              <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Operator" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner className="h-4 w-4" /> : "Create user"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-7 w-7 text-brand-500" />
        </div>
      ) : (
        <div className="card divide-y divide-slate-50">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 p-4">
              <Avatar name={u.name} color={u.color || ROLE_COLORS[u.role]} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                  <span className="badge text-[10px]" style={{ backgroundColor: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role] }}>
                    {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                <Fingerprint className="h-3.5 w-3.5" />
                {u.passkey_count}
              </div>
              <StatusBadge status={u.active ? "active" : "inactive"} />

              {canPermissions && (
                <button
                  onClick={() => setManagePermsFor(u.id)}
                  className="btn-secondary px-2.5 py-1.5 text-xs"
                  title="Permissions"
                >
                  <UserCog className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setEditing({ ...u })} className="btn-secondary px-2.5 py-1.5 text-xs">
                Edit
              </button>
              {u.role !== "super_admin" && (
                <button
                  onClick={() => toggleActive(u)}
                  className={`px-2.5 py-1.5 text-xs font-semibold ${u.active ? "text-rose-500 hover:text-rose-600" : "text-emerald-500 hover:text-emerald-600"}`}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={updateUser} className="card w-full max-w-lg space-y-4 p-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Edit user</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} disabled={editing.role === "super_admin" && !isSuperAdmin}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
              <div>
                <label className="label">New password (optional)</label>
                <input type="password" className="input" value={editing.password || ""} onChange={(e) => setEditing({ ...editing, password: e.target.value })} placeholder="Leave blank to keep" />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input" value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} />
              </div>
              <div>
                <label className="label">Designation</label>
                <input className="input" value={editing.designation} onChange={(e) => setEditing({ ...editing, designation: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner className="h-4 w-4" /> : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
