"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Fingerprint,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Clock,
  Building2,
  Sparkles,
  Radio,
} from "lucide-react";
import { Spinner } from "./ui";
import { formatTime, IST } from "@/lib/utils";

export const ATTENDANCE_EVENT = "hrmate:attendance";

interface PunchWidgetProps {
  canPunch: boolean;
  today: any;
  factory: { name: string; radius: number; address: string };
}

export default function PunchWidget({ canPunch, today, factory }: PunchWidgetProps) {
  const router = useRouter();
  const [record, setRecord] = useState(today);
  const [punching, setPunching] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "outside" | "error">("idle");
  const [slowGps, setSlowGps] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: IST,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRecord(today);
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/attendance", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.today !== undefined) setRecord(d.today);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (geoState !== "locating") {
      setSlowGps(false);
      return;
    }
    const t = setTimeout(() => setSlowGps(true), 4000);
    return () => clearTimeout(t);
  }, [geoState]);

  const punchedIn = record?.punch_in_at && !record?.punch_out_at;
  const punchedOut = record?.punch_in_at && record?.punch_out_at;
  const gpsOk = record?.punch_in_lat != null;

  function getLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported on this device"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error("Location permission denied. Enable GPS to punch.")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function punch() {
    setPunching(true);
    setError("");
    setMessage("");
    setGeoState("locating");
    try {
      const pos = await getLocation();
      const res = await fetch("/api/attendance", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeoState("outside");
        setError(data.error || "Failed to punch");
        return;
      }
      setRecord(data.record);
      setGeoState("idle");
      const action = data.record.punch_out_at ? "Punched out" : "Punched in";
      setMessage(`${action} at ${formatTime(Date.now())} ✓`);
      window.dispatchEvent(new Event(ATTENDANCE_EVENT));
      router.refresh();
    } catch (e: any) {
      setGeoState("error");
      setError(e.message || "Failed to get location");
    } finally {
      setPunching(false);
    }
  }

  if (!canPunch) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B192C] via-[#1E3E62] to-[#0A2647] p-5 text-white shadow-xl sm:p-7">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-[#10B981]/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-52 w-52 rounded-full bg-[#1E6FE0]/20 blur-3xl" />

      {/* Header Info Pills */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-semibold text-white/90 backdrop-blur-md">
            <Radio className="h-3.5 w-3.5 text-[#10B981] animate-pulse" />
            Live Geofence
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-medium text-white/90 backdrop-blur-md">
            <Building2 className="h-3.5 w-3.5 text-[#38BDF8]" />
            {factory.name} ({factory.radius}m)
          </span>
        </div>

        {currentTime && (
          <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-[12px] font-bold tabular-nums text-emerald-300 ring-1 ring-white/10">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            {currentTime}
          </div>
        )}
      </div>

      {/* Main Punch Interaction Section */}
      <div className="relative z-10 mt-6 flex flex-col items-center justify-between gap-6 sm:flex-row">
        {/* Status Text & Timestamps */}
        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <Sparkles className="h-3 w-3" />
            {punchedOut ? "Shift Finished" : punchedIn ? "Active Shift" : "Ready to Start"}
          </div>

          <h2 className="mt-1.5 text-[22px] font-black tracking-tight text-white sm:text-[26px]">
            {punchedOut
              ? "Great Work Today! 🎉"
              : punchedIn
              ? "You are Punched In"
              : "Mark Today's Attendance"}
          </h2>
          <p className="mt-1 text-[13px] text-slate-300">
            {punchedOut
              ? "Attendance recorded for today. Have a restful evening."
              : punchedIn
              ? "Live hours tracking active. Remember to punch out at end of shift."
              : "Tap the button below to register your GPS check-in."}
          </p>

          {/* Time metrics mini cards */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 max-w-sm mx-auto sm:mx-0">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                In Time
              </span>
              <p className="mt-0.5 text-[18px] font-black tabular-nums text-emerald-300">
                {record?.punch_in_at ? formatTime(record.punch_in_at) : "—"}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Out Time
              </span>
              <p className="mt-0.5 text-[18px] font-black tabular-nums text-sky-300">
                {record?.punch_out_at ? formatTime(record.punch_out_at) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Punch Button (Big Floating Disc) */}
        <div className="flex shrink-0 flex-col items-center justify-center">
          <button
            type="button"
            onClick={punch}
            disabled={punching || punchedOut}
            aria-label={punchedIn ? "Punch out" : punchedOut ? "Completed" : "Punch in"}
            className={
              punchedOut
                ? "flex h-28 w-28 flex-col items-center justify-center rounded-full bg-emerald-900/60 text-emerald-300 ring-4 ring-emerald-500/30 cursor-default"
                : punchedIn
                ? "group relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 text-white shadow-[0_8px_30px_rgba(244,63,94,0.4)] ring-4 ring-white/20 transition-all hover:scale-105 active:scale-95"
                : "group relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-[#059669] via-[#10B981] to-[#34D399] text-white shadow-[0_8px_30px_rgba(16,185,129,0.5)] ring-4 ring-white/25 transition-all hover:scale-105 active:scale-95"
            }
          >
            {/* Pulsing ring animation */}
            {!punchedOut && !punching && (
              <span className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-25" />
            )}

            {punching ? (
              <Spinner className="h-9 w-9 text-white" />
            ) : punchedOut ? (
              <CheckCircle2 className="h-10 w-10" />
            ) : (
              <Fingerprint className="h-10 w-10 transition-transform group-hover:scale-110" />
            )}
            <span className="mt-1.5 text-[11px] font-extrabold tracking-wide uppercase">
              {punching ? "Locating…" : punchedIn ? "Punch Out" : punchedOut ? "Completed" : "Punch In"}
            </span>
          </button>

          {gpsOk && (
            <a
              className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-300 hover:underline"
              href={`https://www.google.com/maps?q=${record.punch_in_lat},${record.punch_in_lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="h-3.5 w-3.5" /> View Punch Map
            </a>
          )}
        </div>
      </div>

      {/* Status Alerts */}
      {geoState === "locating" && (
        <div className="relative z-10 mt-5 flex items-center gap-2 rounded-2xl bg-sky-500/20 border border-sky-400/30 p-3 text-[12.5px] font-semibold text-sky-200">
          <Navigation className="h-4 w-4 animate-spin text-sky-300" />
          {slowGps
            ? "Acquiring precision GPS fix... Make sure device location is set to High Accuracy."
            : "Verifying factory coordinates with GPS..."}
        </div>
      )}

      {(geoState === "outside" || geoState === "error") && (
        <div className="relative z-10 mt-5 flex items-start justify-between gap-2.5 rounded-2xl bg-rose-500/20 border border-rose-400/30 p-3 text-[12.5px] font-semibold text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={punch}
            className="shrink-0 rounded-lg bg-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500"
          >
            Retry
          </button>
        </div>
      )}

      {message && (
        <div className="relative z-10 mt-5 flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 p-3 text-[12.5px] font-semibold text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
