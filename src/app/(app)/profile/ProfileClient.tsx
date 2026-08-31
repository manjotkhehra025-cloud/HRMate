"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, Plus, Save, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
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
          canFull ? { name, phone, email, department, designation } : { name, phone }
        ),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setUser((u) => ({ ...u, ...d.user }));
      flash("Profile saved");
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
      flash("Password updated");
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
      flash("Passkey registered");
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
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">My profile</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">Photo, name, phone, password and passkeys.</p>
      </div>

      {(toast || err) && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {err || toast}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flow-gradient rounded-[18px] p-5 text-white shadow-glow lg:col-span-2 lg:row-start-1">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} color={user.color} size={72} src={photo} className="ring-2 ring-white/40" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{user.name}</p>
              <p className="truncate text-sm text-white/80">{user.email}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                {user.role.replace("_", " ")}
                {user.designation ? ` · ${user.designation}` : ""}
              </p>
            </div>
            <PhotoPicker prefix="profile" tone="onGradient" layout="stack" disabled={uploading} onPicked={onPhoto} />
          </div>
        </div>

        <form onSubmit={saveProfile} className="card space-y-4 p-5 lg:col-span-2 lg:row-start-2">
          <h2 className="text-[15px] font-semibold text-[#172334]">Profile details</h2>
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
            <div className="sm:col-span-2">
              <label className="label">{t("designation")}</label>
              {canFull ? (
                <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              ) : (
                <input className="input bg-[#F4F7FB]" value={user.designation || "—"} disabled />
              )}
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full sm:ml-auto sm:w-auto">
            {saving ? <Spinner /> : <Save className="h-4 w-4" />} {t("save")}
          </button>
        </form>

        <form onSubmit={savePassword} className="card space-y-3 p-5 lg:col-start-3 lg:row-start-1">
          <h2 className="text-[15px] font-semibold text-[#172334]">{t("changePassword")}</h2>
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
          <button type="submit" disabled={savingPw} className="btn-primary">
            {savingPw ? <Spinner /> : <Save className="h-4 w-4" />} {t("save")}
          </button>
        </form>

        <div className="card space-y-4 p-5 lg:col-start-3 lg:row-start-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#172334]">
            <Fingerprint className="h-4 w-4 text-[#1E6FE0]" /> {t("passkeys")}
          </h2>
          <p className="text-[13px] text-[#8A97A8]">Face ID / fingerprint on this phone.</p>
          <button onClick={registerPasskey} disabled={registering} className="btn-primary w-full">
            {registering ? <Spinner /> : <Plus className="h-3.5 w-3.5" />} Add passkey
          </button>
          {passkeys.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#E3EAF1] py-8 text-center">
              <KeyRound className="h-8 w-8 text-[#C5D0DC]" />
              <p className="text-sm text-[#8A97A8]">No passkeys yet.</p>
            </div>
          ) : (
            passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center gap-3 rounded-[14px] border border-[#E3EAF1] p-3">
                <Smartphone className="h-5 w-5 text-[#1E6FE0]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#172334]">{pk.device_name}</p>
                  <p className="text-xs text-[#8A97A8]">Added {timeAgo(pk.created_at)}</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-[#16B878]" />
                <button onClick={() => removePasskey(pk.id)} className="rounded-lg p-2 text-[#8A97A8] hover:text-[#C52B35]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
