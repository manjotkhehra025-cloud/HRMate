"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Navigation, AlertTriangle, CheckCircle2, LogIn, LogOut } from "lucide-react";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

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
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const punchedIn = record?.punch_in_at && !record?.punch_out_at;
  const punchedOut = record?.punch_in_at && record?.punch_out_at;

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

  const status = punchedOut
    ? { label: "Shift complete", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" }
    : punchedIn
      ? { label: "On duty", className: "bg-amber-50 text-amber-700 ring-amber-600/15" }
      : { label: "Not punched in", className: "bg-slate-100 text-slate-600 ring-slate-400/15" };

  return (
    <div className="card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-brand-100/70 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-violet-100/50 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Today&apos;s attendance
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: IST,
              })}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${status.className}`}
          >
            {punchedIn && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
            )}
            {status.label}
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-5xl">
              {new Date(now).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: IST,
              })}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              Live · IST
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
            <MapPin className="h-3.5 w-3.5" />
            {factory.name}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <LogIn className="h-4 w-4 text-emerald-500" /> Punch In
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {record?.punch_in_at ? formatTime(record.punch_in_at) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <LogOut className="h-4 w-4 text-sky-500" /> Punch Out
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {record?.punch_out_at ? formatTime(record.punch_out_at) : "—"}
            </p>
          </div>
        </div>

        <button
          onClick={punch}
          disabled={punching || punchedOut}
          className={
            punchedIn
              ? "btn-danger mt-5 h-14 w-full text-base"
              : punchedOut
                ? "btn-success mt-5 h-14 w-full text-base"
                : "btn-primary mt-5 h-14 w-full text-base shadow-glow"
          }
        >
          {punching ? (
            <>
              <Spinner className="h-5 w-5" /> Locating GPS…
            </>
          ) : punchedIn ? (
            <>
              <LogOut className="h-5 w-5" /> Punch Out
            </>
          ) : punchedOut ? (
            <>
              <CheckCircle2 className="h-5 w-5" /> Completed
            </>
          ) : (
            <>
              <LogIn className="h-5 w-5" /> Punch In
            </>
          )}
        </button>

        {geoState === "locating" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Navigation className="h-3.5 w-3.5 animate-pulse text-brand-500" />
            Acquiring your location…
          </p>
        )}
        {geoState === "outside" && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        {geoState === "error" && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        {message && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {message}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          <span>Must be inside the factory geofence</span>
          <span>Radius {factory.radius}m</span>
        </div>
      </div>
    </div>
  );
}
