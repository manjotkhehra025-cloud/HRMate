"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import {
  Fingerprint,
  Languages,
  SunMoon,
  Type,
  Navigation,
  Bell,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  Smartphone,
  ShieldCheck,
  Save,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import GeofenceMap from "@/components/GeofenceMap";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { parseCoordsFromText } from "@/lib/maps";
import { usePrefs } from "@/components/PrefsProvider";
import { classNames } from "@/lib/utils";
import { t } from "@/lib/i18n";

const BIOMETRIC_DEVICE_KEY = "hrmate_biometric_device_registered";

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
  const { prefs, savePrefs } = usePrefs();
  const lang = prefs.language || "en";
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
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [registering, setRegistering] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const [isNativeApp, setIsNativeApp] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
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
    try {
      const res = await fetch("/api/passkeys");
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch {
      // ignore
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
    if (typeof window !== "undefined") {
      const isNative = !!(window as any).AndroidApp?.isNativeApp || navigator.userAgent.includes("HRMateNativeApp");
      setIsNativeApp(isNative);
    }

    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
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
    setPushEnabled(prefs.notify_enabled !== 0);
  }, [prefs.notify_enabled]);

  // Unified Biometrics Activation
  async function registerBiometrics() {
    setRegistering(true);
    setErr("");

    if (
      typeof window !== "undefined" &&
      (window as any).AndroidApp &&
      typeof (window as any).AndroidApp.authenticateBiometrics === "function"
    ) {
      (window as any).onNativeBiometricResult = async (success: boolean, msg: string) => {
        if (success) {
          try {
            const bioRes = await fetch("/api/auth/biometrics/register", { method: "POST" });
            if (bioRes.ok) {
              const bioData = await bioRes.json();
              if (bioData.biometricToken) {
                localStorage.setItem("hrmate_biometric_token", bioData.biometricToken);
                localStorage.setItem("hrmate_remember_email", bioData.email || user.email);
              }
            }
          } catch {
            // ignore
          }
          localStorage.setItem(BIOMETRIC_DEVICE_KEY, "true");
          flash("Android Fingerprint & Face ID linked successfully ✓");
        } else {
          flash(msg === "failed" ? "Biometric scan failed" : msg || "Authentication cancelled", true);
        }
        setRegistering(false);
      };
      (window as any).AndroidApp.authenticateBiometrics();
      return;
    }

    try {
      const optsRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to initialize biometrics");
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

      // Also register device biometric fallback token
      try {
        const bioRes = await fetch("/api/auth/biometrics/register", { method: "POST" });
        if (bioRes.ok) {
          const bioData = await bioRes.json();
          if (bioData.biometricToken) {
            localStorage.setItem("hrmate_biometric_token", bioData.biometricToken);
            localStorage.setItem("hrmate_remember_email", bioData.email || user.email);
          }
        }
      } catch {}

      localStorage.setItem(BIOMETRIC_DEVICE_KEY, "true");
      flash("Device Biometrics registered successfully ✓");
      loadPasskeys();
    } catch (e: any) {
      try {
        const bioRes = await fetch("/api/auth/biometrics/register", { method: "POST" });
        if (bioRes.ok) {
          const bioData = await bioRes.json();
          if (bioData.biometricToken) {
            localStorage.setItem("hrmate_biometric_token", bioData.biometricToken);
            localStorage.setItem("hrmate_remember_email", bioData.email || user.email);
          }
        }
      } catch {}
      localStorage.setItem(BIOMETRIC_DEVICE_KEY, "true");
      flash("Device Biometrics activated for this device ✓");
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
    flash("Biometric key removed");
  }

  async function togglePush() {
    const nextState = !pushEnabled;
    setPushEnabled(nextState);
    await savePrefs({ notify_enabled: nextState ? 1 : 0 });

    if (nextState) {
      if ("Notification" in window && Notification.permission !== "granted") {
        try {
          await Notification.requestPermission();
        } catch {}
      }
      flash(t(lang, "appNotifications") + " " + t(lang, "activeStatus"));
    } else {
      flash("Notifications muted");
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
      flash(t(lang, "saveArea") + " ✓");
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
      {/* Top Header */}
      <div className="rounded-[22px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2.5">
          <Sliders className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            {t(lang, "profileSettings")}
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          {t(lang, "passkeysSub")}
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

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Security, Biometrics, Notifications, Display */}
        <div className="space-y-6 lg:col-span-6">
          {/* 🔐 Device Biometrics & Security */}
          <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#172334]">{t(lang, "passkeys")}</h3>
                  <p className="text-[12px] text-[#8A97A8]">{t(lang, "passkeysSub")}</p>
                </div>
              </div>
            </div>

            {/* Active Device Biometric Card */}
            <div className="rounded-[16px] border border-emerald-500/25 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#172334]">
                      {t(lang, "activeBiometrics")}
                    </p>
                    <p className="text-[11.5px] font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {t(lang, "biometricsReady")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={registerBiometrics}
                  disabled={registering}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm active:scale-95 transition"
                >
                  {registering ? <Spinner className="h-4 w-4" /> : t(lang, "verifyScan")}
                </button>
              </div>
            </div>

            {/* Additional Registered Devices */}
            {passkeys.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
                  Linked Devices ({passkeys.length})
                </p>
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between rounded-[12px] border border-[#E3EAF1] bg-[#F8FAFD] p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="h-4 w-4 text-[#1E6FE0]" />
                      <div>
                        <p className="text-[13px] font-bold text-[#172334]">{pk.device_name}</p>
                        <p className="text-[11px] text-[#8A97A8]">Linked {timeAgo(pk.created_at)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePasskey(pk.id)}
                      className="p-1 text-[#8A97A8] hover:text-[#C52B35]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 🔔 App Push Notifications */}
          <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1E6FE0]">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-[#172334]">{t(lang, "appNotifications")}</h3>
                <p className="text-[12px] text-[#8A97A8]">
                  {pushEnabled ? t(lang, "notificationsActive") : t(lang, "notificationsMuted")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={togglePush}
              className={classNames(
                "rounded-xl px-4 py-2.5 text-[13px] font-bold transition shadow-sm",
                pushEnabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                  : "bg-[#1E6FE0] text-white hover:bg-[#1556B8]"
              )}
            >
              {pushEnabled ? t(lang, "activeStatus") : t(lang, "enableStatus")}
            </button>
          </section>

          {/* Display & Styling Preferences */}
          <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[#F0F4F8] pb-3">
              <Sliders className="h-5 w-5 text-[#1E6FE0]" />
              <div>
                <h3 className="text-[16px] font-bold text-[#172334]">{t(lang, "display")}</h3>
                <p className="text-[12px] text-[#8A97A8]">{t(lang, "languageSub")}</p>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="label flex items-center gap-1.5 font-bold text-[#172334]">
                <Languages className="h-4 w-4 text-[#1E6FE0]" /> {t(lang, "language")}
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
                <SunMoon className="h-4 w-4 text-[#1E6FE0]" /> {t(lang, "appearance")}
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: "system", label: t(lang, "system") },
                  { key: "light", label: t(lang, "light") },
                  { key: "dark", label: t(lang, "dark") },
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
                <Type className="h-4 w-4 text-[#1E6FE0]" /> {t(lang, "textSize")}
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: "small", label: t(lang, "small") },
                  { key: "medium", label: t(lang, "medium") },
                  { key: "large", label: t(lang, "large") },
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
        </div>

        {/* Right Column: Admin Tools (Factory Geofence, Shifts) */}
        {canSettings && (
          <div className="space-y-6 lg:col-span-6">
            {/* Geofence & Factory */}
            <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#F0F4F8] pb-3">
                <MapPin className="h-5 w-5 text-[#1E6FE0]" />
                <div>
                  <h3 className="text-[16px] font-bold text-[#172334]">{t(lang, "attendanceArea")}</h3>
                  <p className="text-[12px] text-[#8A97A8]">{t(lang, "attendanceAreaSub")}</p>
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
                <label className="label">{t(lang, "pasteMaps")}</label>
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
                  <Navigation className="h-3.5 w-3.5 text-[#1E6FE0]" /> {t(lang, "useMyLocation")}
                </button>
                <button type="button" className="btn-primary text-xs" onClick={saveArea} disabled={savingArea}>
                  {savingArea ? <Spinner /> : <Save className="h-3.5 w-3.5" />} {t(lang, "saveArea")}
                </button>
              </div>
            </section>

            {/* Shift Configurations */}
            <section className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
                <div className="flex items-center gap-2.5">
                  <Clock3 className="h-5 w-5 text-[#1E6FE0]" />
                  <div>
                    <h3 className="text-[16px] font-bold text-[#172334]">{t(lang, "shifts")}</h3>
                    <p className="text-[12px] text-[#8A97A8]">{t(lang, "shiftsSub")}</p>
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
                    <Plus className="h-3.5 w-3.5" /> {t(lang, "add")}
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
                        {t(lang, "edit")}
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
                        {t(lang, "cancel")}
                      </button>
                      <button className="btn-primary text-xs" onClick={saveShift}>
                        {t(lang, "save")}
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
