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
  CheckCircle2,
  Sliders,
  Building,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import PhotoPicker, { postAvatar } from "@/components/PhotoPicker";
import GeofenceMap from "@/components/GeofenceMap";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { parseCoordsFromText } from "@/lib/maps";
import { usePrefs } from "@/components/PrefsProvider";
import { classNames } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/staff";

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
  reset_period?: string;
}
interface Shift {
  id: string;
  name: string;
  start_time: string;
  hours: number;
  auto_pick: string;
}

export default function SettingsClient({
  user: initialUser,
  canSettings: initialCanSettings,
  canProfileFull: initialCanProfileFull = false,
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
    avatar?: string;
  };
  canSettings: boolean;
  canProfileFull?: boolean;
  vapidPublicKey: string;
  factoryName: string;
}) {
  const { prefs, t, savePrefs } = usePrefs();
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [canSettings, setCanSettings] = useState(initialCanSettings);
  const [canProfileFull, setCanProfileFull] = useState(initialCanProfileFull);
  const [factory, setFactory] = useState({
    name: factoryName,
    lat: 0,
    lng: 0,
    radius: 100,
    address: "",
  });
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [registering, setRegistering] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const [pushState, setPushState] = useState<"on" | "off" | "denied" | "unsupported">("off");
  const [mapsLink, setMapsLink] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [placeName, setPlaceName] = useState("");

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
        }
        if (d.factory) setFactory((f) => ({ ...f, ...d.factory }));
        if (typeof d.canSettings === "boolean") setCanSettings(d.canSettings);
        if (typeof d.canProfileFull === "boolean") setCanProfileFull(d.canProfileFull);
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
    setPasskeys((p) => p.filter((x) => x.id !== id));
    flash("Passkey removed");
  }

  async function togglePush() {
    if (pushState === "unsupported" || pushState === "denied") return;
    if (pushState === "on") {
      await savePrefs({ notify_enabled: 0 });
      setPushState("off");
      flash("Notifications disabled");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPushState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey,
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      await savePrefs({ notify_enabled: 1 });
      setPushState("on");
      flash("Push notifications activated ✓");
    } catch (e: any) {
      flash("Failed to enable push: " + e.message, true);
    }
  }

  async function saveArea() {
    setSavingArea(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factory_name: factory.name,
          factory_lat: factory.lat,
          factory_lng: factory.lng,
          factory_radius: factory.radius,
          factory_address: placeName || factory.address,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      flash("Factory geofence settings saved ✓");
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setSavingArea(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return flash("GPS not supported", true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFactory((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        flash("Coordinates fetched from current location");
      },
      () => flash("Location permission denied", true)
    );
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/admin/geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const d = await res.json();
        if (d.address) setPlaceName(d.address);
      }
    } catch {}
  }

  function applyMapsLink() {
    const c = parseCoordsFromText(mapsLink);
    if (!c) return flash("Could not parse coordinates from link", true);
    setFactory((f) => ({ ...f, lat: c.lat, lng: c.lng }));
    reverseGeocode(c.lat, c.lng);
    flash("Coordinates updated from link");
  }

  async function saveShift() {
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingShift === "new" ? undefined : editingShift,
        ...shiftForm,
        hours: parseFloat(shiftForm.hours) || 8,
      }),
    });
    if (res.ok) {
      setEditingShift(null);
      loadAdmin();
      flash("Shift saved ✓");
    } else {
      flash("Failed to save shift", true);
    }
  }

  async function deleteShift(id: string) {
    if (!confirm("Delete this shift?")) return;
    await fetch("/api/admin/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadAdmin();
    flash("Shift deleted");
  }

  return (
    <div className="space-y-6">
      {/* Top Header - Always visible on Mobile & Desktop */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2">
          <Sliders className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            Settings & System Preferences
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          Display styling, biometrics, language preferences, geofence radius, and workplace configuration.
        </p>
      </div>

      {(toast || err) && (
        <div
          className={`rounded-[14px] p-3.5 text-[13.5px] font-bold ${
            err
              ? "bg-[#FDECEC] text-[#C52B35] border border-[#C52B35]/20"
              : "bg-[#E1F8EF] text-[#06613E] border border-[#16B878]/20"
          }`}
        >
          {err || toast}
        </div>
      )}

      {/* 2-Column Grid for Web */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Preferences, Notifications, Passkeys */}
        <div className="space-y-6 lg:col-span-6">
          {/* System Preferences */}
          <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[#F0F4F8] pb-3">
              <Sliders className="h-5 w-5 text-[#1E6FE0]" />
              <div>
                <h3 className="text-[16px] font-bold text-[#172334]">Display & Interface</h3>
                <p className="text-[12px] text-[#8A97A8]">Language, Theme, and Font Size</p>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="label flex items-center gap-1.5 font-bold text-[#172334]">
                <Languages className="h-4 w-4 text-[#1E6FE0]" /> Interface Language
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: "en", label: "English" },
                  { key: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
                  { key: "hi", label: "हिन्दी (Hindi)" },
                ].map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => savePrefs({ language: l.key as any })}
                    className={classNames(
                      "rounded-[12px] border p-2.5 text-[13px] font-bold transition",
                      prefs.language === l.key
                        ? "border-[#1E6FE0] bg-[#E7F1FF] text-[#1E6FE0]"
                        : "border-[#E3EAF1] bg-white text-[#617083] hover:bg-[#F8FAFD]"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="pt-2">
              <label className="label flex items-center gap-1.5 font-bold text-[#172334]">
                <SunMoon className="h-4 w-4 text-[#1E6FE0]" /> Color Mode
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: "system", label: "Auto (System)" },
                  { key: "light", label: "Light Mode" },
                  { key: "dark", label: "Dark Mode" },
                ].map((th) => (
                  <button
                    key={th.key}
                    type="button"
                    onClick={() => savePrefs({ appearance: th.key as any })}
                    className={classNames(
                      "rounded-[12px] border p-2.5 text-[13px] font-bold transition",
                      prefs.appearance === th.key
                        ? "border-[#1E6FE0] bg-[#E7F1FF] text-[#1E6FE0]"
                        : "border-[#E3EAF1] bg-white text-[#617083] hover:bg-[#F8FAFD]"
                    )}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Size */}
            <div className="pt-2">
              <label className="label flex items-center gap-1.5 font-bold text-[#172334]">
                <Type className="h-4 w-4 text-[#1E6FE0]" /> Typography Scaling
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: "small", label: "Compact" },
                  { key: "medium", label: "Default" },
                  { key: "large", label: "Spacious" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => savePrefs({ text_size: s.key as any })}
                    className={classNames(
                      "rounded-[12px] border p-2.5 text-[13px] font-bold transition",
                      prefs.text_size === s.key
                        ? "border-[#1E6FE0] bg-[#E7F1FF] text-[#1E6FE0]"
                        : "border-[#E3EAF1] bg-white text-[#617083] hover:bg-[#F8FAFD]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Passkeys & Biometrics */}
          <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="h-5 w-5 text-[#1E6FE0]" />
                <div>
                  <h3 className="text-[16px] font-bold text-[#172334]">Biometric Passkeys</h3>
                  <p className="text-[12px] text-[#8A97A8]">Passwordless Touch ID, Face ID, and Windows Hello</p>
                </div>
              </div>
              <button
                type="button"
                onClick={registerPasskey}
                disabled={registering}
                className="btn-primary text-[12px] py-1.5 px-3"
              >
                {registering ? <Spinner /> : <Plus className="h-3.5 w-3.5" />} Add Device
              </button>
            </div>

            {passkeys.length === 0 ? (
              <div className="py-6 text-center text-[#8A97A8]">
                <KeyRound className="mx-auto h-8 w-8 text-[#C5D0DC] mb-1.5" />
                <p className="text-[13px] font-semibold text-[#172334]">No passkeys registered</p>
                <p className="text-[12px] text-[#8A97A8]">Register this browser/device for instant 1-touch login.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between rounded-[12px] border border-[#E3EAF1] bg-[#F8FAFD] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-[#1E6FE0]" />
                      <div>
                        <p className="text-[13.5px] font-bold text-[#172334]">{pk.device_name}</p>
                        <p className="text-[11.5px] text-[#8A97A8]">Added {timeAgo(pk.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#16B878]" />
                      <button
                        type="button"
                        onClick={() => removePasskey(pk.id)}
                        className="p-1.5 text-[#8A97A8] hover:text-[#C52B35]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Web Push Notifications */}
          <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#E7F1FF] text-[#1E6FE0]">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-[#172334]">Browser Push Notifications</h3>
                <p className="text-[12px] text-[#8A97A8]">
                  {pushState === "on"
                    ? "Notifications active for shift punches and approvals"
                    : "Receive instant updates about shift reminders & requests"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={togglePush}
              className={classNames(
                "rounded-[12px] px-4 py-2 text-[13px] font-bold transition",
                pushState === "on"
                  ? "bg-[#E1F8EF] text-[#06613E] border border-[#16B878]/30 hover:bg-[#c9f2e3]"
                  : "btn-primary"
              )}
            >
              {pushState === "on" ? "Active" : "Enable"}
            </button>
          </section>
        </div>

        {/* Right Column: Admin Tools (Factory Geofence, Shifts, Leave Balances) */}
        {canSettings && (
          <div className="space-y-6 lg:col-span-6">
            {/* Geofence & Factory */}
            <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#F0F4F8] pb-3">
                <MapPin className="h-5 w-5 text-[#1E6FE0]" />
                <div>
                  <h3 className="text-[16px] font-bold text-[#172334]">Workplace Geofencing</h3>
                  <p className="text-[12px] text-[#8A97A8]">Location boundaries required for mobile/web punches</p>
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

              <div className="rounded-[12px] bg-[#F8FAFD] border border-[#E3EAF1] p-3 text-[12.5px] text-[#617083]">
                <span className="font-bold text-[#172334]">Current Target: </span>
                {placeName || factory.address || `${factory.lat.toFixed(5)}, ${factory.lng.toFixed(5)}`} ·{" "}
                <span className="font-semibold text-[#1E6FE0]">{factory.radius}m perimeter</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Radius (meters)</label>
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
                  <label className="label">Factory Facility Name</label>
                  <input
                    className="input"
                    value={factory.name}
                    onChange={(e) => setFactory((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Paste Google Maps URL or Coordinates</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="https://maps.google.com/… or 31.63, 74.87"
                    value={mapsLink}
                    onChange={(e) => setMapsLink(e.target.value)}
                  />
                  <button type="button" className="btn-secondary px-4 text-xs" onClick={applyMapsLink}>
                    Locate
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F0F4F8]">
                <button type="button" className="btn-secondary text-xs" onClick={useMyLocation}>
                  <Navigation className="h-3.5 w-3.5 text-[#1E6FE0]" /> Use Current Device GPS
                </button>
                <button type="button" className="btn-primary text-xs" onClick={saveArea} disabled={savingArea}>
                  {savingArea ? <Spinner /> : <Save className="h-3.5 w-3.5" />} Save Geofence Settings
                </button>
              </div>
            </section>

            {/* Shift Configurations */}
            <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
                <div className="flex items-center gap-2.5">
                  <Clock3 className="h-5 w-5 text-[#1E6FE0]" />
                  <div>
                    <h3 className="text-[16px] font-bold text-[#172334]">Shift Schedule Configuration</h3>
                    <p className="text-[12px] text-[#8A97A8]">Working shifts and automatic punch assignment</p>
                  </div>
                </div>
                {editingShift !== "new" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShiftForm({ name: "", start_time: "08:00", hours: "8", auto_pick: "none" });
                      setEditingShift("new");
                    }}
                    className="btn-primary text-[12px] py-1.5 px-3"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Shift
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {shifts.map((sh) => (
                  <div
                    key={sh.id}
                    className="rounded-[12px] border border-[#E3EAF1] bg-[#F8FAFD] p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[14px] font-bold text-[#172334]">{sh.name}</p>
                      <p className="text-[12px] text-[#8A97A8]">
                        Starts {sh.start_time} · {sh.hours} hours
                        {sh.auto_pick === "morning"
                          ? " (Morning auto-pick)"
                          : sh.auto_pick === "evening"
                            ? " (Evening auto-pick)"
                            : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1.5 text-[#1E6FE0] hover:underline text-xs font-bold"
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
                        Edit
                      </button>
                      <button onClick={() => deleteShift(sh.id)} className="p-1.5 text-[#8A97A8] hover:text-[#C52B35]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {editingShift && (
                  <div className="rounded-[14px] border border-[#1E6FE0]/40 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-[13px] font-bold text-[#172334]">
                      {editingShift === "new" ? "New Shift" : "Edit Shift"}
                    </p>
                    <input
                      className="input"
                      placeholder="Shift Name (e.g. Morning Shift)"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        className="input"
                        value={shiftForm.start_time}
                        onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                      />
                      <input
                        type="number"
                        className="input"
                        placeholder="Hours"
                        value={shiftForm.hours}
                        onChange={(e) => setShiftForm({ ...shiftForm, hours: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button className="btn-secondary text-xs" onClick={() => setEditingShift(null)}>
                        Cancel
                      </button>
                      <button className="btn-primary text-xs" onClick={saveShift}>
                        Save Shift
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
