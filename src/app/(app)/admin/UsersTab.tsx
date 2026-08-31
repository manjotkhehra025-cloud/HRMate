"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, X, Fingerprint, UserCog, Search, Shield, Building2, User, Key, CheckCircle2, Trash2, Edit3 } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import PhotoPicker, { postAvatar } from "@/components/PhotoPicker";
import { Spinner, StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permission-constants";
import { APPROVER_DESIGNATIONS, DEPARTMENTS, MANAGER_SCOPES, WEEKDAYS } from "@/lib/staff";
import PermissionPanel from "./PermissionPanel";

interface UserItem {
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
  super_admin: "#1E6FE0",
  admin: "#07945D",
  manager: "#1E6FE0",
  employee: "#16B878",
};

export default function UsersTab({
  kind,
  isSuperAdmin,
  canPermissions,
}: {
  kind: "control" | "staff";
  isSuperAdmin: boolean;
  canPermissions: boolean;
}) {
  const isControl = kind === "control";
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<(UserItem & { password?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [managePermsFor, setManagePermsFor] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: isControl ? "manager" : "employee",
    department: "Production",
    designation: isControl ? "Senior Manager Production" : "",
    staff_type: "official",
    manager_scope: "operations",
    weekly_off: 6,
  });
  const [caps, setCaps] = useState({ total: 70, yellow_card: 50, official: 20 });
  const [counts, setCounts] = useState({ total: 0, yellow: 0, official: 0 });
  const deptNames = DEPARTMENTS.map((d) => d.name);

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
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
      role: isControl ? "manager" : "employee",
      department: "Production",
      designation: isControl ? "Senior Manager Production" : "",
      staff_type: "official",
      manager_scope: "operations",
      weekly_off: 6,
    });
  }

  const visibleUsers = useMemo(() => {
    return users.filter((u) => {
      const isMatchKind = isControl ? u.role !== "employee" : u.role === "employee";
      const isMatchSearch =
        !search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(search.toLowerCase())) ||
        (u.designation && u.designation.toLowerCase().includes(search.toLowerCase()));
      return isMatchKind && isMatchSearch;
    });
  }, [users, isControl, search]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: isControl ? form.role : "employee" }),
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
      setMessage("User created successfully ✓");
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
      setMessage("User updated successfully ✓");
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserItem) {
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
    <div className="space-y-5">
      {/* Search & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${isControl ? "administrators" : "employees"} by name, email, department…`}
            className="h-11 w-full rounded-[12px] border border-[#E3EAF1] bg-white pl-10 pr-4 text-[13.5px] text-[#172334] outline-none focus:border-[#1E6FE0]"
          />
        </div>

        <div className="flex items-center gap-3">
          {!isControl && (
            <div className="hidden items-center gap-2 text-[12.5px] font-semibold text-[#617083] md:flex">
              <span className="rounded-full bg-[#E7F1FF] px-3 py-1 text-[#1E6FE0]">
                Official: {counts.official}/{caps.official}
              </span>
              <span className="rounded-full bg-[#FFF4E0] px-3 py-1 text-[#D98200]">
                Yellow Card: {counts.yellow}/{caps.yellow_card}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setPendingPhoto(null);
              resetForm();
            }}
            className="flex h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[13.5px] font-bold text-white shadow-[0_4px_14px_rgba(30,111,224,0.3)] transition hover:bg-[#1556B8]"
          >
            <Plus className="h-4 w-4" /> {isControl ? "Add Admin / Manager" : "Add Employee"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-[12px] bg-[#E1F8EF] p-3 text-[13.5px] font-semibold text-[#06613E]">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-[12px] bg-[#FDECEC] p-3 text-[13.5px] font-semibold text-[#C52B35]">
          {error}
        </div>
      )}

      {/* Creation Modal / Form */}
      {showForm && (
        <form onSubmit={createUser} className="card space-y-4 p-6 animate-fade-in border border-[#1E6FE0]/30 shadow-pop">
          <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
            <h3 className="text-[16px] font-bold text-[#172334]">
              {isControl ? "Create New System Administrator / Manager" : "Create New Employee Profile"}
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-[#8A97A8] hover:text-[#172334]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="label">Profile Picture</label>
            <PhotoPicker prefix="new-user" onPicked={setPendingPhoto} />
            {pendingPhoto && (
              <p className="mt-1 text-[12px] font-medium text-[#16B878]">Photo selected — will upload upon creation</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="label">Role</label>
              {isControl ? (
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                </select>
              ) : (
                <input className="input bg-[#F4F7FB]" value="Employee" disabled />
              )}
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
                {deptNames.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Designation</label>
              {isControl ? (
                <select
                  className="input"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  required
                >
                  {APPROVER_DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="Admin">Admin</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              ) : (
                <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Machine Operator" />
              )}
            </div>
            <div>
              <label className="label">Staff Type</label>
              <select className="input" value={form.staff_type} onChange={(e) => setForm({ ...form, staff_type: e.target.value })}>
                <option value="official">Official G.D. Foods Staff</option>
                <option value="yellow_card">Yellow card / Third party</option>
              </select>
            </div>
            <div>
              <label className="label">Weekly Off</label>
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
            {isControl && form.role === "manager" && (
              <div className="sm:col-span-2">
                <label className="label">Manager Scope</label>
                <select
                  className="input"
                  value={form.manager_scope}
                  onChange={(e) => setForm({ ...form, manager_scope: e.target.value })}
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

          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />} Create Account
            </button>
          </div>
        </form>
      )}

      {/* Users Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-[#1E6FE0]" />
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-[15px] font-bold text-[#172334]">No matching records found</p>
          <p className="text-[13px] text-[#8A97A8] mt-1">Try adjusting your search criteria or add a new user.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleUsers.map((u) => (
            <div
              key={u.id}
              className="card p-5 flex flex-col justify-between hover:shadow-pop transition duration-150 border border-[#E3EAF1]"
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <Avatar
                    name={u.name}
                    color={u.color || ROLE_COLORS[u.role]}
                    size={48}
                    src={avatarSrc(u.id, u.avatar)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-[#172334]">{u.name}</p>
                    <p className="truncate text-[12.5px] text-[#8A97A8]">{u.email}</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-[#1E6FE0]">
                      {u.department || "No Department"} · {u.designation || u.role.replace("_", " ")}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[#E7F1FF] px-2.5 py-0.5 text-[11px] font-bold text-[#1E6FE0] capitalize">
                    {u.role.replace("_", " ")}
                  </span>
                  {u.staff_type === "yellow_card" ? (
                    <span className="rounded-full bg-[#FFF4E0] border border-[#F5A623]/30 px-2.5 py-0.5 text-[11px] font-bold text-[#D98200]">
                      Yellow Card
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#F4F7FB] border border-[#E3EAF1] px-2.5 py-0.5 text-[11px] font-semibold text-[#617083]">
                      Official Staff
                    </span>
                  )}
                  <StatusBadge status={u.active ? "active" : "inactive"} />
                  {u.passkey_count > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E1F8EF] px-2 py-0.5 text-[11px] font-bold text-[#06613E]">
                      <Fingerprint className="h-3 w-3" /> {u.passkey_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 border-t border-[#F0F4F8] pt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {canPermissions && (
                    <button
                      type="button"
                      onClick={() => setManagePermsFor(u.id)}
                      className="rounded-[8px] p-2 text-[#617083] hover:bg-[#F4F7FB] hover:text-[#1E6FE0]"
                      title="Manage Permissions"
                    >
                      <UserCog className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing({ ...u })}
                    className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-[#172334] hover:bg-[#F4F7FB]"
                  >
                    <Edit3 className="inline h-3.5 w-3.5 mr-1 text-[#1E6FE0]" /> Edit
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {u.role !== "super_admin" && (
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      className={`text-[12px] font-bold ${
                        u.active ? "text-[#C52B35] hover:underline" : "text-[#16B878] hover:underline"
                      }`}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  )}

                  {isSuperAdmin && u.role !== "super_admin" && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete ${u.name}? This action cannot be undone.`)) return;
                        const res = await fetch("/api/admin/users", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: u.id }),
                        });
                        const d = await res.json();
                        if (!res.ok) setError(d.error || "Delete failed");
                        else load();
                      }}
                      className="p-1.5 text-[#8A97A8] hover:text-[#C52B35]"
                      title="Delete User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit User Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#081C33]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={updateUser}
            className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6 animate-fade-in shadow-pop border border-[#E3EAF1]"
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <h3 className="text-[16px] font-bold text-[#172334]">Edit Profile: {editing.name}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-[#8A97A8] hover:text-[#172334]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
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
                    setMessage("Photo updated ✓");
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
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  disabled={editing.role === "super_admin" && !isSuperAdmin}
                >
                  {isControl ? (
                    <>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                    </>
                  ) : (
                    <option value="employee">Employee</option>
                  )}
                </select>
              </div>
              <div>
                <label className="label">New Password (optional)</label>
                <input
                  type="password"
                  className="input"
                  value={editing.password || ""}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  placeholder="Leave blank to keep"
                />
              </div>
              <div>
                <label className="label">Department</label>
                <select className="input" value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })}>
                  {editing.department && !deptNames.includes(editing.department) && (
                    <option value={editing.department}>{editing.department}</option>
                  )}
                  {deptNames.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Designation</label>
                {isControl ? (
                  <select className="input" value={editing.designation} onChange={(e) => setEditing({ ...editing, designation: e.target.value })}>
                    {APPROVER_DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                ) : (
                  <input className="input" value={editing.designation} onChange={(e) => setEditing({ ...editing, designation: e.target.value })} />
                )}
              </div>
              <div>
                <label className="label">Weekly Off</label>
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
                <label className="label">Staff Type</label>
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
                  <label className="label">Manager Scope</label>
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

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#F0F4F8]">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner /> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
