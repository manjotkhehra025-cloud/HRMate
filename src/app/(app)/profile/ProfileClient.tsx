"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import {
  ChevronRight,
  User,
  Lock,
  Fingerprint,
  Languages,
  SunMoon,
  Type,
  Navigation,
  Bell,
  BellOff,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  Smartphone,
  KeyRound,
  ShieldCheck,
  LogOut,
  Save,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import GeofenceMap from "@/components/GeofenceMap";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { parseCoordsFromText } from "@/lib/maps";
import { usePrefs } from "@/components/PrefsProvider";
import { classNames } from "@/lib/utils";

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: number;
}
interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  color: string;
}
interface Shift {
  id: string;
  name: string;
  start_time: string;
  hours: number;
  auto_pick: string;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function Row({
  icon,
  title,
  sub,
  onClick,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#F8FAFD]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        {sub && <p className="truncate text-[12px] text-muted">{sub}</p>}
      </div>
      {trailing ?? <ChevronRight className="h-4 w-4 text-slate-300" />}
    </Comp>
  );
}

export default function ProfileClient({
  user: initialUser,
  canSettings: initialCanSettings,
  vapidPublicKey,
  factoryName,
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
  };
  canSettings: boolean;
  vapidPublicKey: string;
  factoryName: string;
}) {
  const { prefs, t, savePrefs } = usePrefs();
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [canSettings, setCanSettings] = useState(initialCanSettings);
  const [factory, setFactory] = useState({
    name: factoryName,
    lat: 0,
    lng: 0,
    radius: 100,
    address: "",
  });
  const [open, setOpen] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [registering, setRegistering] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const [name, setName] = useState(initialUser.name);
  const [phone, setPhone] = useState(initialUser.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [pushState, setPushState] = useState<"on" | "off" | "denied" | "unsupported">("off");

  const [geoMsg, setGeoMsg] = useState("");
  const [geoChecking, setGeoChecking] = useState(false);

  const [mapsLink, setMapsLink] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [placeName, setPlaceName] = useState("");

  const [editingLeave, setEditingLeave] = useState<string | null>(null);
  const [newLeaveName, setNewLeaveName] = useState("");
  const [newLeaveDays, setNewLeaveDays] = useState("0");

  const [editingShift, setEditingShift] = useState<string | "new" | null>(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    start_time: "08:00",
    hours: "8",
    auto_pick: "none",
  });

  function flash(msg: string, isErr = false) {
    setToast(isErr ? "" : msg);
    setErr(isErr ? msg : "");
    setTimeout(() => {
      setToast("");
      setErr("");
    }, 4000);
  }

  async function loadPasskeys() {
    const res = await fetch("/api/passkeys");
    if (res.ok) {
      const data = await res.json();
      setPasskeys(data.passkeys || []);
    }
  }

  async function loadAdmin() {
    const [s, l] = await Promise.all([
      fetch("/api/admin/settings", { cache: "no-store" }),
      fetch("/api/admin/shifts", { cache: "no-store" }),
    ]);
    if (s.ok) {
      const d = await s.json();
      if (d.factory) {
        setFactory({
          name: d.factory.name,
          lat: d.factory.lat,
          lng: d.factory.lng,
          radius: d.factory.radius,
          address: d.factory.address || "",
        });
        setPlaceName(d.factory.address || "");
      }
      if (d.leaveTypes) setLeaveTypes(d.leaveTypes);
    }
    if (l.ok) {
      const d = await l.json();
      setShifts(d.shifts || []);
    }
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
        if (d.factory) setFactory((f) => ({ ...f, ...d.factory }));
        if (typeof d.canSettings === "boolean") setCanSettings(d.canSettings);
      })
      .catch(() => {});
    loadPasskeys();
  }, []);

  useEffect(() => {
    if (canSettings) loadAdmin();
  }, [canSettings]);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") setPushState("denied");
    else if (Notification.permission === "granted" && prefs.notify_enabled) setPushState("on");
    else setPushState("off");
  }, [prefs.notify_enabled]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
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
      setSavingProfile(false);
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
      setOpen(null);
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
      loadPasskeys();
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
    loadPasskeys();
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function togglePush(on: boolean) {
    if (!on) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
      } catch {
        /* still persist off */
      }
      await savePrefs({ notify_enabled: 0 });
      setPushState("off");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      await savePrefs({ notify_enabled: 1 });
      setPushState("on");
    } catch (e: any) {
      flash(e.message || "Could not enable notifications", true);
    }
  }

  async function checkLocation() {
    if (!navigator.geolocation) {
      setGeoMsg("GPS is not available on this device");
      return;
    }
    setGeoChecking(true);
    setGeoMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const dist = Math.round(haversine(here, { lat: factory.lat, lng: factory.lng }));
        const inside = dist <= factory.radius;
        setGeoMsg(
          `${inside ? t("insideFence") : t("outsideFence")} · ${dist}m away · accuracy ${Math.round(pos.coords.accuracy)}m · ${here.lat.toFixed(5)}, ${here.lng.toFixed(5)}`
        );
        setGeoChecking(false);
      },
      () => {
        setGeoMsg("Location permission denied. Enable GPS and try again.");
        setGeoChecking(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function reverseGeocode(lat: number, lng: number) {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/geocode?lat=${lat}&lng=${lng}`);
        if (r.ok) {
          const d = await r.json();
          if (d.address) {
            setPlaceName(d.address);
            setFactory((f) => ({ ...f, address: d.address }));
          }
        }
      } catch {
        /* ignore */
      }
    }, 500);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      flash("GPS not available", true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFactory((f) => ({ ...f, lat, lng }));
        reverseGeocode(lat, lng);
      },
      () => flash("Location permission denied", true),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function applyMapsLink() {
    const local = parseCoordsFromText(mapsLink);
    if (local) {
      setFactory((f) => ({ ...f, lat: local.lat, lng: local.lng }));
      reverseGeocode(local.lat, local.lng);
      flash("Pin moved to that location");
      return;
    }
    const res = await fetch("/api/admin/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: mapsLink }),
    });
    const d = await res.json();
    if (!res.ok) {
      flash(d.error || "Could not read that link", true);
      return;
    }
    setFactory((f) => ({ ...f, lat: d.lat, lng: d.lng }));
    reverseGeocode(d.lat, d.lng);
    flash("Pin moved to that location");
  }

  async function saveArea() {
    setSavingArea(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factory: {
            name: factory.name,
            lat: factory.lat,
            lng: factory.lng,
            radius: factory.radius,
            address: factory.address || placeName,
          },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      if (d.factory) setFactory((f) => ({ ...f, ...d.factory }));
      flash("Attendance area saved");
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setSavingArea(false);
    }
  }

  async function saveLeave(lt: LeaveType) {
    const res = await fetch("/api/admin/leave-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lt),
    });
    const d = await res.json();
    if (!res.ok) {
      flash(d.error || "Save failed", true);
      return;
    }
    setLeaveTypes(d.leaveTypes);
    setEditingLeave(null);
    flash("Leave entitlement saved");
  }

  async function addLeave() {
    const res = await fetch("/api/admin/leave-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLeaveName, days_per_year: parseInt(newLeaveDays, 10) || 0 }),
    });
    const d = await res.json();
    if (!res.ok) {
      flash(d.error || "Could not add", true);
      return;
    }
    setLeaveTypes(d.leaveTypes);
    setNewLeaveName("");
    setNewLeaveDays("0");
    flash("Leave type added");
  }

  async function saveShift(id?: string) {
    const payload = {
      id,
      name: shiftForm.name,
      start_time: shiftForm.start_time,
      hours: parseFloat(shiftForm.hours),
      auto_pick: shiftForm.auto_pick,
    };
    const res = await fetch("/api/admin/shifts", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) {
      flash(d.error || "Could not save shift", true);
      return;
    }
    setShifts(d.shifts);
    setEditingShift(null);
    flash("Shift saved");
  }

  async function deleteShift(id: string) {
    const res = await fetch("/api/admin/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const d = await res.json();
    if (res.ok) setShifts(d.shifts);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleLabel = user.role.replace("_", " ");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {(toast || err) && (
        <p
          className={classNames(
            "rounded-xl px-3 py-2 text-sm font-medium",
            err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {err || toast}
        </p>
      )}

      {/* Gradient profile card */}
      <div className="flow-gradient overflow-hidden rounded-[18px] p-5 text-white shadow-glow">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} color={user.color} size={64} className="ring-2 ring-white/40" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.name}</p>
            <p className="truncate text-sm text-white/80">{user.email}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
              {roleLabel} · {factory.name}
            </p>
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-kicker text-muted">
          {t("account")}
        </p>
        <Row
          icon={<User className="h-5 w-5" />}
          title={t("myProfile")}
          sub={t("myProfileSub")}
          onClick={() => setOpen(open === "profile" ? null : "profile")}
        />
        {open === "profile" && (
          <form onSubmit={saveProfile} className="space-y-3 border-t border-line px-4 py-4">
            <div>
              <label className="label">{t("name")}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t("phone")}</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
            </div>
            <div>
              <label className="label">{t("email")}</label>
              <input className="input bg-[#F4F7FB]" value={user.email} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("department")}</label>
                <input className="input bg-[#F4F7FB]" value={user.department || "—"} disabled />
              </div>
              <div>
                <label className="label">{t("designation")}</label>
                <input className="input bg-[#F4F7FB]" value={user.designation || "—"} disabled />
              </div>
            </div>
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? <Spinner /> : <Save className="h-4 w-4" />} {t("save")}
            </button>
          </form>
        )}

        <Row
          icon={<Lock className="h-5 w-5" />}
          title={t("changePassword")}
          sub={t("changePasswordSub")}
          onClick={() => setOpen(open === "password" ? null : "password")}
        />
        {open === "password" && (
          <form onSubmit={savePassword} className="space-y-3 border-t border-line px-4 py-4">
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
        )}

        <Row
          icon={<Fingerprint className="h-5 w-5" />}
          title={t("passkeys")}
          sub={t("passkeysSub")}
          onClick={() => setOpen(open === "passkeys" ? null : "passkeys")}
        />
        {open === "passkeys" && (
          <div className="space-y-3 border-t border-line px-4 py-4">
            <button onClick={registerPasskey} disabled={registering} className="btn-primary text-xs">
              {registering ? <Spinner /> : <Plus className="h-3.5 w-3.5" />} Add passkey
            </button>
            {passkeys.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-8 text-center">
                <KeyRound className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-muted">No passkeys yet. Add Face ID / fingerprint on this phone.</p>
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
                  <button
                    onClick={() => removePasskey(pk.id)}
                    className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-kicker text-muted">
          {t("display")}
        </p>
        <Row
          icon={<Languages className="h-5 w-5" />}
          title={t("language")}
          sub={prefs.language === "pa" ? t("punjabi") : t("english")}
          onClick={() => setOpen(open === "lang" ? null : "lang")}
        />
        {open === "lang" && (
          <div className="grid grid-cols-2 gap-2 border-t border-line px-4 py-3">
            {(["en", "pa"] as const).map((l) => (
              <button
                key={l}
                onClick={() => savePrefs({ language: l })}
                className={classNames(
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold",
                  prefs.language === l
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line text-ink"
                )}
              >
                {l === "en" ? t("english") : t("punjabi")}
              </button>
            ))}
          </div>
        )}

        <Row
          icon={<SunMoon className="h-5 w-5" />}
          title={t("appearance")}
          sub={t(prefs.appearance)}
          onClick={() => setOpen(open === "theme" ? null : "theme")}
        />
        {open === "theme" && (
          <div className="grid grid-cols-3 gap-2 border-t border-line px-4 py-3">
            {(["light", "dark", "system"] as const).map((a) => (
              <button
                key={a}
                onClick={() => savePrefs({ appearance: a })}
                className={classNames(
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize",
                  prefs.appearance === a
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line text-ink"
                )}
              >
                {t(a)}
              </button>
            ))}
          </div>
        )}

        <Row
          icon={<Type className="h-5 w-5" />}
          title={t("textSize")}
          sub={t(prefs.text_size)}
          onClick={() => setOpen(open === "text" ? null : "text")}
        />
        {open === "text" && (
          <div className="grid grid-cols-3 gap-2 border-t border-line px-4 py-3">
            {(["small", "medium", "large"] as const).map((s) => (
              <button
                key={s}
                onClick={() => savePrefs({ text_size: s })}
                className={classNames(
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold",
                  prefs.text_size === s
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line text-ink"
                )}
              >
                {t(s)}
              </button>
            ))}
          </div>
        )}

        <Row
          icon={<Navigation className="h-5 w-5" />}
          title={t("locationCheck")}
          sub={t("locationCheckSub")}
          onClick={() => setOpen(open === "geo" ? null : "geo")}
        />
        {open === "geo" && (
          <div className="space-y-3 border-t border-line px-4 py-4">
            <p className="text-xs text-muted">
              {factory.name} · {factory.radius}m radius
            </p>
            <button onClick={checkLocation} disabled={geoChecking} className="btn-secondary text-xs">
              {geoChecking ? <Spinner /> : <Navigation className="h-3.5 w-3.5" />} Check my GPS
            </button>
            {geoMsg && <p className="text-sm text-ink">{geoMsg}</p>}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-kicker text-muted">
          {t("notifications")}
        </p>
        <Row
          icon={pushState === "on" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          title={t("notifications")}
          sub={
            pushState === "denied"
              ? "Blocked in the browser"
              : pushState === "unsupported"
                ? "Not supported on this device"
                : t("notifySub")
          }
          trailing={
            <button
              type="button"
              role="switch"
              aria-checked={pushState === "on"}
              disabled={pushState === "unsupported" || pushState === "denied"}
              onClick={() => togglePush(pushState !== "on")}
              className={classNames(
                "relative h-7 w-12 rounded-full transition",
                pushState === "on" ? "bg-flow" : "bg-slate-300"
              )}
            >
              <span
                className={classNames(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                  pushState === "on" ? "left-5" : "left-0.5"
                )}
              />
            </button>
          }
        />
      </section>

      {canSettings && (
        <>
          <section className="card overflow-hidden">
            <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-kicker text-muted">
              {t("leaveEntitlements")}
            </p>
            <p className="px-4 pb-2 text-[12px] text-muted">{t("leaveEntitlementsSub")}</p>
            {leaveTypes.map((lt) => (
              <div key={lt.id} className="flex items-center gap-3 border-t border-line px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: lt.color }} />
                <div className="min-w-0 flex-1">
                  {editingLeave === lt.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="input h-9 min-h-0 py-1"
                        value={lt.name}
                        onChange={(e) =>
                          setLeaveTypes((ls) =>
                            ls.map((x) => (x.id === lt.id ? { ...x, name: e.target.value } : x))
                          )
                        }
                      />
                      <input
                        type="number"
                        className="input h-9 min-h-0 w-20 py-1"
                        value={lt.days_per_year}
                        onChange={(e) =>
                          setLeaveTypes((ls) =>
                            ls.map((x) =>
                              x.id === lt.id
                                ? { ...x, days_per_year: parseInt(e.target.value) || 0 }
                                : x
                            )
                          )
                        }
                      />
                      <button className="btn-primary h-9 px-3 text-xs" onClick={() => saveLeave(lt)}>
                        {t("save")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-ink">{lt.name}</p>
                      <p className="text-xs text-muted">{lt.days_per_year} days / year</p>
                    </>
                  )}
                </div>
                {editingLeave !== lt.id && (
                  <button
                    className="text-xs font-semibold text-brand-600"
                    onClick={() => setEditingLeave(lt.id)}
                  >
                    <Pencil className="mr-1 inline h-3.5 w-3.5" />
                    {t("edit")}
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 border-t border-line px-4 py-3">
              <input
                className="input h-9 min-h-0 flex-1 py-1"
                placeholder="New leave type"
                value={newLeaveName}
                onChange={(e) => setNewLeaveName(e.target.value)}
              />
              <input
                type="number"
                className="input h-9 min-h-0 w-16 py-1"
                value={newLeaveDays}
                onChange={(e) => setNewLeaveDays(e.target.value)}
              />
              <button className="btn-secondary h-9 px-3 text-xs" onClick={addLeave} disabled={!newLeaveName.trim()}>
                <Plus className="h-3.5 w-3.5" /> {t("add")}
              </button>
            </div>
          </section>

          <section className="card overflow-hidden">
            <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-kicker text-muted">
              {t("shifts")}
            </p>
            <p className="px-4 pb-2 text-[12px] text-muted">{t("shiftsSub")}</p>
            {shifts.map((sh) => (
              <div key={sh.id} className="border-t border-line px-4 py-3">
                {editingShift === sh.id ? (
                  <ShiftFields
                    form={shiftForm}
                    setForm={setShiftForm}
                    onSave={() => saveShift(sh.id)}
                    onCancel={() => setEditingShift(null)}
                    saveLabel={t("save")}
                    cancelLabel={t("cancel")}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand-50 text-brand-600">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{sh.name}</p>
                      <p className="text-xs text-muted">
                        {sh.start_time} · {sh.hours}h
                        {sh.auto_pick === "morning"
                          ? " · morning punch"
                          : sh.auto_pick === "evening"
                            ? " · evening punch"
                            : ""}
                      </p>
                    </div>
                    <button
                      className="text-xs font-semibold text-brand-600"
                      onClick={() => {
                        setShiftForm({
                          name: sh.name,
                          start_time: sh.start_time,
                          hours: String(sh.hours),
                          auto_pick: sh.auto_pick,
                        });
                        setEditingShift(sh.id);
                      }}
                    >
                      {t("edit")}
                    </button>
                    <button onClick={() => deleteShift(sh.id)} className="p-2 text-slate-300 hover:text-rose-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {editingShift === "new" ? (
              <div className="border-t border-line px-4 py-3">
                <ShiftFields
                  form={shiftForm}
                  setForm={setShiftForm}
                  onSave={() => saveShift()}
                  onCancel={() => setEditingShift(null)}
                  saveLabel={t("save")}
                  cancelLabel={t("cancel")}
                />
              </div>
            ) : (
              <button
                className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-brand-600"
                onClick={() => {
                  setShiftForm({ name: "", start_time: "08:00", hours: "8", auto_pick: "none" });
                  setEditingShift("new");
                }}
              >
                <Plus className="h-4 w-4" /> {t("add")} shift
              </button>
            )}
          </section>

          <section className="card overflow-hidden p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-ink">{t("attendanceArea")}</p>
                <p className="text-xs text-muted">{t("attendanceAreaSub")}</p>
              </div>
            </div>
            <GeofenceMap
              lat={factory.lat}
              lng={factory.lng}
              radius={factory.radius}
              onChange={({ lat, lng }) => {
                setFactory((f) => ({ ...f, lat, lng }));
                reverseGeocode(lat, lng);
              }}
            />
            <p className="mt-2 text-xs text-muted">
              {placeName || factory.address || `${factory.lat.toFixed(5)}, ${factory.lng.toFixed(5)}`}
              {" · "}
              {factory.radius}m circle · drag the pin
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Radius (m)</label>
                <input
                  type="number"
                  className="input"
                  value={factory.radius}
                  onChange={(e) =>
                    setFactory((f) => ({ ...f, radius: parseFloat(e.target.value) || 100 }))
                  }
                />
              </div>
              <div>
                <label className="label">Factory name</label>
                <input
                  className="input"
                  value={factory.name}
                  onChange={(e) => setFactory((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">{t("pasteMaps")}</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="https://maps.google.com/… or 31.63, 74.87"
                  value={mapsLink}
                  onChange={(e) => setMapsLink(e.target.value)}
                />
                <button type="button" className="btn-secondary shrink-0" onClick={applyMapsLink}>
                  Go
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={useMyLocation}>
                <Navigation className="h-3.5 w-3.5" /> {t("useMyLocation")}
              </button>
              <button type="button" className="btn-primary text-xs" onClick={saveArea} disabled={savingArea}>
                {savingArea ? <Spinner /> : <Save className="h-3.5 w-3.5" />} {t("saveArea")}
              </button>
            </div>
          </section>
        </>
      )}

      <button onClick={logout} className="btn-danger w-full">
        <LogOut className="h-4 w-4" /> {t("signOut")}
      </button>
    </div>
  );
}

function ShiftFields({
  form,
  setForm,
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
}: {
  form: { name: string; start_time: string; hours: string; auto_pick: string };
  setForm: (f: { name: string; start_time: string; hours: string; auto_pick: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
}) {
  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="Shift name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="time"
          className="input"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
        />
        <input
          type="number"
          className="input"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />
      </div>
      <select
        className="input"
        value={form.auto_pick}
        onChange={(e) => setForm({ ...form, auto_pick: e.target.value })}
      >
        <option value="none">No auto-pick</option>
        <option value="morning">Auto: morning punch</option>
        <option value="evening">Auto: evening punch</option>
      </select>
      <div className="flex gap-2">
        <button className="btn-primary text-xs" onClick={onSave}>
          {saveLabel}
        </button>
        <button className="btn-ghost text-xs" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
