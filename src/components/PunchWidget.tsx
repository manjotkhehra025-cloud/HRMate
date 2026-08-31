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

  const heading = punchedOut
    ? "Shift Completed"
    : punchedIn
      ? "Currently Punched In"
      : "Ready to Punch In";
  const sub = punchedOut
    ? "Great work today! See you tomorrow."
    : punchedIn
      ? "You are logged in. Remember to punch out before leaving."
      : "Punch in when you reach the workplace.";

  return (
    <div className="card relative overflow-hidden p-6 sm:p-7 border border-[#E3EAF1] shadow-[0_4px_20px_rgba(18,58,99,0.06)]">
      {/* Decorative background circle */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-[#1E6FE0]/5 to-[#16B878]/5 blur-2xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Top meta tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F1FF] px-3 py-1 text-[12px] font-semibold text-[#1E6FE0]">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: IST,
              })}
            </span>

            {currentTime && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F7FB] px-3 py-1 text-[12px] font-bold tabular-nums text-[#172334] border border-[#E3EAF1]">
                <Clock className="h-3.5 w-3.5 text-[#617083]" />
                {currentTime}
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F7FB] px-3 py-1 text-[12px] font-medium text-[#617083] border border-[#E3EAF1]">
              <Building2 className="h-3.5 w-3.5 text-[#1E6FE0]" />
              {factory.name} ({factory.radius}m)
            </span>
          </div>

          <div>
            <h2 className="text-[22px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
              {heading}
            </h2>
            <p className="mt-1 text-[13.5px] text-[#617083]">{sub}</p>
          </div>

          {/* Punch Timestamps */}
          <div className="grid max-w-md grid-cols-2 gap-3 pt-2">
            <div className="rounded-[14px] bg-[#F8FAFD] border border-[#E3EAF1] p-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
                Punch In Time
              </span>
              <p className="mt-1 text-[20px] font-bold tabular-nums text-[#172334]">
                {record?.punch_in_at ? formatTime(record.punch_in_at) : "—"}
              </p>
              {record?.punch_in_at && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#16B878]">
                  <CheckCircle2 className="h-3 w-3" /> Recorded
                </span>
              )}
            </div>

            <div className="rounded-[14px] bg-[#F8FAFD] border border-[#E3EAF1] p-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
                Punch Out Time
              </span>
              <p className="mt-1 text-[20px] font-bold tabular-nums text-[#172334]">
                {record?.punch_out_at ? formatTime(record.punch_out_at) : "—"}
              </p>
              {record?.punch_out_at ? (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E6FE0]">
                  <CheckCircle2 className="h-3 w-3" /> Recorded
                </span>
              ) : (
                <span className="mt-1 inline-block text-[11px] text-[#8A97A8]">Pending</span>
              )}
            </div>
          </div>

          {gpsOk && (
            <div className="pt-1">
              <a
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1E6FE0] hover:underline"
                href={`https://www.google.com/maps?q=${record.punch_in_lat},${record.punch_in_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin className="h-3.5 w-3.5" /> View Punch Geolocation on Map
              </a>
            </div>
          )}
        </div>

        {/* Big Action Punch Button */}
        <div className="flex shrink-0 flex-col items-center justify-center pt-2 lg:pt-0">
          <button
            type="button"
            onClick={punch}
            disabled={punching || punchedOut}
            aria-label={punchedIn ? "Punch out" : punchedOut ? "Completed" : "Punch in"}
            className={
              punchedOut
                ? "flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#E1F8EF] text-[#06613E] ring-4 ring-[#16B878]/20 cursor-default"
                : punchedIn
                  ? "flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#FDECEC] text-[#C52B35] ring-4 ring-[#C52B35]/20 shadow-[0_8px_24px_rgba(197,43,53,0.22)] transition-all hover:scale-105 active:scale-95"
                  : "flow-gradient flex h-28 w-28 flex-col items-center justify-center rounded-full text-white shadow-glow ring-4 ring-[#1E6FE0]/25 transition-all hover:scale-105 active:scale-95"
            }
          >
            {punching ? (
              <Spinner className="h-9 w-9 text-white" />
            ) : punchedOut ? (
              <CheckCircle2 className="h-10 w-10" />
            ) : (
              <Fingerprint className="h-10 w-10" />
            )}
            <span className="mt-1.5 text-[12px] font-bold tracking-wide">
              {punching ? "Locating…" : punchedIn ? "Punch Out" : punchedOut ? "Completed" : "Punch In"}
            </span>
          </button>

          {(geoState === "error" || geoState === "outside") && (
            <button
              type="button"
              onClick={punch}
              className="mt-3 text-[13px] font-semibold text-[#1E6FE0] hover:underline"
            >
              Retry GPS Punch
            </button>
          )}
        </div>
      </div>

      {/* Status alerts */}
      {geoState === "locating" && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#E7F1FF] px-4 py-2.5 text-[13px] font-medium text-[#1E6FE0]">
          <Navigation className="h-4 w-4 animate-pulse text-[#1E6FE0]" />
          {slowGps
            ? "Acquiring GPS fix. If taking too long, move near a window or check location permissions."
            : "Acquiring precision factory GPS coordinates…"}
        </div>
      )}

      {(geoState === "outside" || geoState === "error") && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#FFF4E0] px-4 py-3 text-[13px] font-medium text-[#995B00] border border-[#F5A623]/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D98200]" />
          <div>{error}</div>
        </div>
      )}

      {message && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#E1F8EF] px-4 py-3 text-[13px] font-semibold text-[#06613E] border border-[#16B878]/30">
          <CheckCircle2 className="h-4 w-4 text-[#16B878]" />
          {message}
        </div>
      )}
    </div>
  );
}
