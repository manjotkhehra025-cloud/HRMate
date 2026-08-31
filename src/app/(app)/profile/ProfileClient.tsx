"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, Plus, Save, ShieldCheck, Smartphone, Trash2, ShieldAlert, User } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import PhotoPicker, { postAvatar } from "@/components/PhotoPicker";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";
import { DEPARTMENTS } from "@/lib/staff";

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: number;
}

export default function ProfileClient({
  user: initialUser,
  canFull = false,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    designation: string;
    phone?: string;
    color: string;
    avatar?: string;
    staff_type?: string;
  };
  canFull?: boolean;
}) {
  const { t } = usePrefs();
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [phone, setPhone] = useState(initialUser.phone || "");
  const [email, setEmail] = useState(initialUser.email);
  const [department, setDepartment] = useState(initialUser.department || "");
  const [designation, setDesignation] = useState(initialUser.designation || "");
  const [staffType, setStaffType] = useState(initialUser.staff_type || "official");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [registering, setRegistering] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [uploading, setUploading] = useState(false);

  function flash(msg: string, isErr = false) {
    setToast(isErr ? "" : msg);
    setErr(isErr ? msg : "");
    setTimeout(() => {
      setToast("");
      setErr("");
    }, 4000);
  }

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setName(d.user.name);
          setPhone(d.user.phone || "");
          setEmail(d.user.email || "");
          setDepartment(d.user.department || "");
          setDesignation(d.user.designation || "");
          setStaffType(d.user.staff_type || "official");
        }
      })
      .catch(() => {});
    fetch("/api/passkeys")
      .then((r) => r.json())
      .then((d) => setPasskeys(d.passkeys || []))
      .catch(() => {});
  }, []);

  async function onPhoto(file: File) {
    setUploading(true);
    try {
      const stamp = await postAvatar(file);
      setUser((u) => ({ ...u, avatar: stamp }));
      flash("Photo saved");
      router.refresh();
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          canFull
            ? { name, phone, email, department, designation, staff_type: staffType }
            : { name, phone }
        ),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setUser((u) => ({ ...u, ...d.user }));
      flash("Profile saved successfully ✓");
      router.refresh();
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      flash("New passwords do not match", true);
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not change password");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      flash("Password updated successfully ✓");
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setSavingPw(false);
    }
  }

  async function registerPasskey() {
    setRegistering(true);
    try {
      const optsRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start registration");
      const options = await optsRes.json();
      const attResp = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json();
        throw new Error(d.error || "Registration failed");
      }
      flash("Passkey registered successfully ✓");
      const list = await fetch("/api/passkeys").then((r) => r.json());
      setPasskeys(list.passkeys || []);
    } catch (e: any) {
      flash(e?.message || "Passkey registration failed", true);
    } finally {
      setRegistering(false);
    }
  }

  async function removePasskey(id: string) {
    await fetch("/api/passkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPasskeys((p) => p.filter((x) => x.id !== id));
  }

  const photo = avatarSrc(user.id, user.avatar);

  return (
    <div className="space-y-6">
      {/* Top Header - Always visible on Mobile & Desktop */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            My Profile & Security
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          Manage your personal information, staff category, password, and biometric passkeys.
        </p>
      </div>

      {(toast || err) && (
        <div
          className={`rounded-[14px] p-3.5 text-[13.5px] font-bold ${
            err ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {err || toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Profile Card Banner */}
        <div className="flow-gradient rounded-[18px] p-6 text-white shadow-glow lg:col-span-2 lg:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} color={user.color} size={76} src={photo} className="ring-4 ring-white/30 shadow-md" />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold">{user.name}</p>
                <p className="truncate text-[13.5px] text-white/85">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    {user.role.replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {staffType === "yellow_card" ? "🟡 Yellow Card Staff" : "Official Staff"}
                  </span>
                </div>
              </div>
            </div>
            <PhotoPicker prefix="profile" tone="onGradient" layout="stack" disabled={uploading} onPicked={onPhoto} />
          </div>
        </div>

        {/* Profile Details Form */}
        <form onSubmit={saveProfile} className="card space-y-4 p-6 lg:col-span-2 lg:row-start-2 border border-[#E3EAF1] shadow-card">
          <h2 className="text-[16px] font-bold text-[#172334] border-b border-[#F0F4F8] pb-2.5">
            Profile Details & Staff Category
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("name")}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t("phone")}</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("email")}</label>
              {canFull ? (
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              ) : (
                <input className="input bg-[#F4F7FB]" value={user.email} disabled />
              )}
            </div>
            <div>
              <label className="label">Staff Category</label>
              {canFull ? (
                <select className="input font-semibold" value={staffType} onChange={(e) => setStaffType(e.target.value)}>
                  <option value="yellow_card">🟡 Yellow card / Third party (15 EL Only)</option>
                  <option value="official">Official G.D. Foods Staff</option>
                </select>
              ) : (
                <input
                  className="input bg-[#F4F7FB]"
                  value={staffType === "yellow_card" ? "Yellow card (15 EL)" : "Official Staff"}
                  disabled
                />
              )}
            </div>
            <div>
              <label className="label">{t("department")}</label>
              {canFull ? (
                <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {department && !DEPARTMENTS.some((d) => d.name === department) && (
                    <option value={department}>{department}</option>
                  )}
                  {DEPARTMENTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input bg-[#F4F7FB]" value={user.department || "—"} disabled />
              )}
            </div>
            <div>
              <label className="label">{t("designation")}</label>
              {canFull ? (
                <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              ) : (
                <input className="input bg-[#F4F7FB]" value={user.designation || "—"} disabled />
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? <Spinner /> : <Save className="h-4 w-4" />} Save Profile
            </button>
          </div>
        </form>

        {/* Password Form */}
        <form onSubmit={savePassword} className="card space-y-3.5 p-6 lg:col-start-3 lg:row-start-1 border border-[#E3EAF1] shadow-card">
          <h2 className="text-[16px] font-bold text-[#172334] border-b border-[#F0F4F8] pb-2.5">
            {t("changePassword")}
          </h2>
          <div>
            <label className="label">{t("currentPassword")}</label>
            <input type="password" className="input" value={curPw} onChange={(e) => setCurPw(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t("newPassword")}</label>
            <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
          </div>
          <div>
            <label className="label">{t("confirmPassword")}</label>
            <input
              type="password"
              className="input"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button type="submit" disabled={savingPw} className="btn-primary w-full">
            {savingPw ? <Spinner /> : <Save className="h-4 w-4" />} Update Password
          </button>
        </form>

        {/* Passkeys Card */}
        <div className="card space-y-4 p-6 lg:col-start-3 lg:row-start-2 border border-[#E3EAF1] shadow-card">
          <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-2.5">
            <h2 className="flex items-center gap-2 text-[16px] font-bold text-[#172334]">
              <Fingerprint className="h-4 w-4 text-[#1E6FE0]" /> {t("passkeys")}
            </h2>
            <button onClick={registerPasskey} disabled={registering} className="btn-primary text-xs py-1.5 px-3">
              {registering ? <Spinner /> : <Plus className="h-3.5 w-3.5" />} Add
            </button>
          </div>
          <p className="text-[12.5px] text-[#8A97A8]">
            Instant biometric passwordless authentication using Touch ID, Face ID or device PIN.
          </p>

          {passkeys.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-[#E3EAF1] py-7 text-center">
              <KeyRound className="mx-auto h-7 w-7 text-[#C5D0DC]" />
              <p className="text-[13px] text-[#8A97A8]">No passkeys registered on this account.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center gap-3 rounded-[12px] border border-[#E3EAF1] bg-[#F8FAFD] p-3">
                  <Smartphone className="h-5 w-5 text-[#1E6FE0]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-[#172334]">{pk.device_name}</p>
                    <p className="text-[11.5px] text-[#8A97A8]">Added {timeAgo(pk.created_at)}</p>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-[#16B878]" />
                  <button onClick={() => removePasskey(pk.id)} className="rounded-lg p-1.5 text-[#8A97A8] hover:text-[#C52B35]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
