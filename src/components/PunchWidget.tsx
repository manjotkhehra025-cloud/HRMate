"use client";

import { useState, useEffect } from "react";
import { MapPin, Clock, Navigation, AlertTriangle, CheckCircle2, LogIn, LogOut } from "lucide-react";
import { Spinner } from "./ui";
import { formatTime } from "@/lib/utils";

interface PunchWidgetProps {
  canPunch: boolean;
  today: any;
  factory: { name: string; radius: number; address: string };
}

export default function PunchWidget({ canPunch, today, factory }: PunchWidgetProps) {
  const [record, setRecord] = useState(today);
  const [punching, setPunching] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "outside" | "error">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

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
    <div className="card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-100/60 blur-2xl" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {"Today's attendance"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
            <MapPin className="h-3.5 w-3.5" />
            {factory.name}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <LogIn className="h-4 w-4 text-emerald-500" /> Punch In
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {record?.punch_in_at ? formatTime(record.punch_in_at) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <LogOut className="h-4 w-4 text-sky-500" /> Punch Out
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {record?.punch_out_at ? formatTime(record.punch_out_at) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={punch}
            disabled={punching || punchedOut}
            className={
              punchedIn
                ? "btn-danger flex-1"
                : "btn-primary flex-1"
            }
          >
            {punching ? (
              <><Spinner className="h-4 w-4" /> Locating GPS…</>
            ) : punchedIn ? (
              <><LogOut className="h-4 w-4" /> Punch Out</>
            ) : punchedOut ? (
              <><CheckCircle2 className="h-4 w-4" /> Completed</>
            ) : (
              <><LogIn className="h-4 w-4" /> Punch In</>
            )}
          </button>
        </div>

        {geoState === "locating" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Navigation className="h-3.5 w-3.5 animate-pulse text-brand-500" />
            Acquiring your location…
          </p>
        )}
        {geoState === "outside" && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        {geoState === "error" && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        {message && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {message}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(now)}
          </span>
          <span>Geofence radius: {factory.radius}m</span>
        </div>
      </div>
    </div>
  );
}
