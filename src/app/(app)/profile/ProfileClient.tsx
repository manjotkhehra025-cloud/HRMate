"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Camera, Fingerprint, KeyRound, Plus, Save, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: number;
}

export default function ProfileClient({
  user: initialUser,
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
}) {
  const { t } = usePrefs();
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [phone, setPhone] = useState(initialUser.phone || "");
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
        }
      })
      .catch(() => {});
    fetch("/api/passkeys")
      .then((r) => r.json())
      .then((d) => setPasskeys(d.passkeys || []))
      .catch(() => {});
  }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      setUser((u) => ({ ...u, avatar: d.avatar }));
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
        body: JSON.stringify({ name, phone }),
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {(toast || err) && (
        <p className={`lg:col-span-3 rounded-xl px-3 py-2 text-sm font-medium ${err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {err || toast}
        </p>
      )}

      <div className="flow-gradient rounded-[18px] p-6 text-white shadow-glow lg:col-span-1">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar name={user.name} color={user.color} size={96} src={photo} className="ring-2 ring-white/40" />
            <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-brand-600 shadow">
              {uploading ? <Spinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
          </div>
          <p className="mt-4 text-lg font-bold">{user.name}</p>
          <p className="text-sm text-white/80">{user.email}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
            {user.role.replace("_", " ")}
          </p>
        </div>
      </div>

      <form onSubmit={saveProfile} className="card space-y-4 p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold text-ink">{t("myProfile")}</h2>
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
            <input className="input bg-[#F4F7FB]" value={user.email} disabled />
          </div>
          <div>
            <label className="label">{t("department")}</label>
            <input className="input bg-[#F4F7FB]" value={user.department || "—"} disabled />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Spinner /> : <Save className="h-4 w-4" />} {t("save")}
        </button>
      </form>

      <form onSubmit={savePassword} className="card space-y-4 p-6 lg:col-span-1">
        <h2 className="text-sm font-semibold text-ink">{t("changePassword")}</h2>
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
          <input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} minLength={8} required />
        </div>
        <button type="submit" disabled={savingPw} className="btn-primary">
          {savingPw ? <Spinner /> : <Save className="h-4 w-4" />} {t("save")}
        </button>
      </form>

      <div className="card space-y-4 p-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Fingerprint className="h-4 w-4 text-brand-500" /> {t("passkeys")}
          </h2>
          <button onClick={registerPasskey} disabled={registering} className="btn-primary px-3 py-2 text-xs">
            {registering ? <Spinner /> : <><Plus className="h-3.5 w-3.5" /> Add passkey</>}
          </button>
        </div>
        {passkeys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
            <KeyRound className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-muted">No passkeys yet.</p>
          </div>
        ) : (
          passkeys.map((pk) => (
            <div key={pk.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <Smartphone className="h-5 w-5 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{pk.device_name}</p>
                <p className="text-xs text-muted">Added {timeAgo(pk.created_at)}</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <button onClick={() => removePasskey(pk.id)} className="rounded-lg p-2 text-slate-300 hover:text-rose-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 480;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          if (!b) reject(new Error("Could not process photo"));
          else resolve(b);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = url;
  });
}
