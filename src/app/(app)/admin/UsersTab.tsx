"use client";

import { useState, useEffect } from "react";
import { Plus, X, Fingerprint, UserCog } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import PhotoPicker, { postAvatar } from "@/components/PhotoPicker";
import { Spinner, StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permission-constants";
import { MANAGER_SCOPES, WEEKDAYS } from "@/lib/staff";
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
  staff_type?: string;
  manager_scope?: string;
  weekly_off?: number;
  avatar?: string;
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
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    department: "Production",
    designation: "",
    staff_type: "official",
    manager_scope: "operations",
    weekly_off: 6,
  });
  const [caps, setCaps] = useState({ total: 70, yellow_card: 50, official: 20 });
  const [counts, setCounts] = useState({ total: 0, yellow: 0, official: 0 });
  const DEPARTMENTS = [
    "Production",
    "Store",
    "Lab",
    "Production & Quality",
    "Maintenance",
    "Instrument",
    "Electrician",
    "Electric",
  ];

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users);
    if (data.caps) setCaps(data.caps);
    if (data.counts) setCounts(data.counts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "employee",
      department: "Production",
      designation: "",
      staff_type: "official",
      manager_scope: "operations",
      weekly_off: 6,
    });
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
      if (pendingPhoto && data.id) {
        try {
          await postAvatar(pendingPhoto, data.id);
        } catch {
          /* user exists; photo can be set from Edit */
        }
      }
      setMessage("User created ✓");
      setShowForm(false);
      setPendingPhoto(null);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm font-semibold text-slate-800">
          Team members <span className="text-slate-400">({users.length})</span>
        </h2>
        <button onClick={() => { setShowForm(true); setPendingPhoto(null); resetForm(); }} className="btn-primary shrink-0 px-3 py-2 text-xs">
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
          <div>
            <label className="label">Profile photo</label>
            <PhotoPicker prefix="new-user" onPicked={setPendingPhoto} />
            {pendingPhoto && (
              <p className="mt-1 text-xs text-muted">Photo selected — saved after create</p>
            )}
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
              <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Designation</label>
              <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Operator" />
            </div>
            <div>
              <label className="label">Staff type</label>
              <select className="input" value={form.staff_type} onChange={(e) => setForm({ ...form, staff_type: e.target.value })}>
                <option value="official">Official G.D. Foods Staff</option>
                <option value="yellow_card">Yellow card / Third party</option>
              </select>
            </div>
            <div>
              <label className="label">Weekly off</label>
              <select
                className="input"
                value={form.weekly_off}
                onChange={(e) => setForm({ ...form, weekly_off: Number(e.target.value) })}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            {form.role === "manager" && (
              <div>
                <label className="label">Manages (by designation)</label>
                <select className="input" value={form.manager_scope} onChange={(e) => setForm({ ...form, manager_scope: e.target.value })}>
                  {MANAGER_SCOPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label} — {s.hint}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
            <div key={u.id} className="flex flex-wrap items-center gap-2 p-4 sm:gap-3">
              <Avatar name={u.name} color={u.color || ROLE_COLORS[u.role]} size={40} src={avatarSrc(u.id, u.avatar)} />
              <div className="min-w-0 flex-1 basis-36">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                  <span className="badge text-[10px]" style={{ backgroundColor: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role] }}>
                    {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
                  </span>
                  {u.staff_type === "yellow_card" && (
                    <span className="badge bg-amber-50 text-[10px] text-amber-700">Yellow card</span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
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
              {isSuperAdmin && u.role !== "super_admin" && (
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
                    const res = await fetch("/api/admin/users", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: u.id }),
                    });
                    const d = await res.json();
                    if (!res.ok) setError(d.error || "Delete failed");
                    else load();
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-600"
                >
                  Delete
                </button>
              )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form onSubmit={updateUser} className="card max-h-[100dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-b-none p-5 animate-fade-in sm:max-h-[90vh] sm:rounded-card sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Edit user</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Avatar
                name={editing.name}
                color={editing.color || ROLE_COLORS[editing.role]}
                size={72}
                src={avatarSrc(editing.id, editing.avatar)}
              />
              <PhotoPicker
                prefix="edit-user"
                disabled={uploadingPhoto || saving}
                onPicked={async (file) => {
                  setUploadingPhoto(true);
                  setError("");
                  try {
                    const stamp = await postAvatar(file, editing.id);
                    setEditing({ ...editing, avatar: stamp });
                    setUsers((list) => list.map((x) => (x.id === editing.id ? { ...x, avatar: stamp } : x)));
                    setMessage("Photo saved ✓");
                  } catch (e: any) {
                    setError(e.message || "Photo upload failed");
                  } finally {
                    setUploadingPhoto(false);
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div>
                <label className="label">Weekly off</label>
                <select
                  className="input"
                  value={editing.weekly_off ?? 6}
                  onChange={(e) => setEditing({ ...editing, weekly_off: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Staff type</label>
                <select
                  className="input"
                  value={editing.staff_type || "official"}
                  onChange={(e) => setEditing({ ...editing, staff_type: e.target.value })}
                >
                  <option value="official">Official G.D. Foods Staff</option>
                  <option value="yellow_card">Yellow card / Third party</option>
                </select>
              </div>
              {editing.role === "manager" && (
                <div className="sm:col-span-2">
                  <label className="label">Manages (by designation)</label>
                  <select
                    className="input"
                    value={editing.manager_scope || "operations"}
                    onChange={(e) => setEditing({ ...editing, manager_scope: e.target.value })}
                  >
                    {MANAGER_SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label} — {s.hint}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
