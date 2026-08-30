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
} from "lucide-react";
import { Spinner } from "./ui";
import { formatTime, IST } from "@/lib/utils";

export const ATTENDANCE_EVENT = "hrmate:attendance";

interface PunchWidgetProps {
  canPunch: boolean;
  today: any;
  factory: { name: string; radius: number; address: string };
  /** flush = sit under the map inside a parent card (attendance). */
  variant?: "card" | "flush";
}

export default function PunchWidget({ canPunch, today, factory, variant = "card" }: PunchWidgetProps) {
  const router = useRouter();
  const [record, setRecord] = useState(today);
  const [punching, setPunching] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "outside" | "error">("idle");
  const [slowGps, setSlowGps] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    ? "Shift complete"
    : punchedIn
      ? "You are punched in"
      : "You haven't punched in";
  const sub = punchedOut
    ? "See you tomorrow."
    : punchedIn
      ? "Remember to punch out before you leave."
      : "Punch in when you reach the factory.";

  return (
    <div className={variant === "flush" ? "" : "card p-5 sm:p-6"}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: IST,
            })}
          </p>
          <h2 className="mt-1 text-[22px] font-bold tracking-[-0.4px] text-ink sm:text-[24px]">{heading}</h2>
          <p className="mt-1 text-[13px] text-muted">{sub}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {gpsOk && (
              <span className="badge bg-[#E1F8EF] text-[#06613E] ring-1 ring-[#07945D]/20">
                GPS verified
              </span>
            )}
            {punchedIn && (
              <span className="badge bg-[#E1F8EF] text-[#06613E] ring-1 ring-[#07945D]/20">Present</span>
            )}
            {punchedOut && (
              <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-500/20">Completed</span>
            )}
            <span className="badge bg-[#F4F7FB] text-muted ring-1 ring-line">
              <MapPin className="h-3 w-3" /> {factory.name} · {factory.radius}m
            </span>
          </div>

          <div className="mt-4 grid max-w-sm grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-muted">Punch in</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-ink">
                {record?.punch_in_at ? formatTime(record.punch_in_at) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-muted">Punch out</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-ink">
                {record?.punch_out_at ? formatTime(record.punch_out_at) : "—"}
              </p>
            </div>
          </div>

          {!gpsOk && !punching && (
            <p className="mt-3 text-[12px] text-muted">No location yet.</p>
          )}
          {gpsOk && (
            <a
              className="mt-3 inline-block text-[12px] font-semibold text-brand-600"
              href={`https://www.google.com/maps?q=${record.punch_in_lat},${record.punch_in_lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center self-center sm:self-auto">
          <button
            type="button"
            onClick={punch}
            disabled={punching || punchedOut}
            aria-label={punchedIn ? "Punch out" : punchedOut ? "Completed" : "Punch in"}
            className={
              punchedOut
                ? "flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#E1F8EF] text-flow-deep sm:h-[112px] sm:w-[112px]"
                : punchedIn
                  ? "flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#FDECEC] text-[#C52B35] shadow-[0_8px_18px_rgba(197,43,53,0.16)] sm:h-[112px] sm:w-[112px]"
                  : "flow-gradient flex h-24 w-24 flex-col items-center justify-center rounded-full text-white shadow-glow sm:h-[112px] sm:w-[112px]"
            }
          >
            {punching ? (
              <Spinner className="h-8 w-8" />
            ) : punchedOut ? (
              <CheckCircle2 className="h-9 w-9" />
            ) : (
              <Fingerprint className="h-9 w-9" />
            )}
            <span className="mt-1 text-[11px] font-bold">
              {punching ? "GPS…" : punchedIn ? "Punch out" : punchedOut ? "Done" : "Punch in"}
            </span>
          </button>
          {(geoState === "error" || geoState === "outside") && (
            <button
              type="button"
              onClick={punch}
              className="mt-2 text-[12px] font-semibold text-brand-600"
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {geoState === "locating" && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Navigation className="h-3.5 w-3.5 animate-pulse text-brand-500" />
          {slowGps
            ? "Your location is taking too long. Step near a window or outside and try again."
            : "Acquiring your location…"}
        </p>
      )}
      {(geoState === "outside" || geoState === "error") && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#E1F8EF] px-3 py-2.5 text-xs text-[#06613E]">
          <CheckCircle2 className="h-3.5 w-3.5" /> {message}
        </p>
      )}
    </div>
  );
}
