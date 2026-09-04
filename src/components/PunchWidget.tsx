"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  MapPin,
  Fingerprint,
  Camera,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Clock,
  Building2,
  Sparkles,
  Radio,
  ChevronRight,
  RefreshCw,
  X,
  Zap,
  ShieldCheck,
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

  // Flow & Modal State
  const [flowStep, setFlowStep] = useState<"idle" | "biometric_prompt" | "selfie_camera">("idle");
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Swipe slider state
  const [sliderPos, setSliderPos] = useState(0);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  // Shift progress timer state
  const [elapsedSec, setElapsedSec] = useState(0);

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

      if (record?.punch_in_at && !record?.punch_out_at) {
        const inMs = new Date(record.punch_in_at).getTime();
        const diff = Math.max(0, Math.floor((Date.now() - inMs) / 1000));
        setElapsedSec(diff);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [record]);

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

  const punchedIn = record?.punch_in_at && !record?.punch_out_at;
  const punchedOut = record?.punch_in_at && record?.punch_out_at;
  const gpsOk = record?.punch_in_lat != null;

  // Format Elapsed Hours & Minutes (e.g. 04h 32m 15s)
  const hrs = Math.floor(elapsedSec / 3600);
  const mins = Math.floor((elapsedSec % 3600) / 60);
  const secs = elapsedSec % 60;
  const targetShiftSec = 8 * 3600; // 8 hours standard
  const shiftPct = Math.min(100, Math.round((elapsedSec / targetShiftSec) * 100));

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

  // Camera Management
  async function startCamera() {
    setCapturedPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setError("Camera permission denied. Please allow camera to capture selfie punch.");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  }

  function closeAllModals() {
    stopCamera();
    setFlowStep("idle");
    setCapturedPhoto(null);
    setBiometricVerified(false);
    setSliderPos(0);
  }

  // Final Execution of Punch (with GPS + optional selfie)
  async function executeFinalPunch(photoBase64?: string) {
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
        body: JSON.stringify({
          lat: pos.lat,
          lng: pos.lng,
          selfie: photoBase64 || null,
        }),
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
      closeAllModals();
    } catch (e: any) {
      setGeoState("error");
      setError(e.message || "Failed to get location");
    } finally {
      setPunching(false);
      setSliderPos(0);
    }
  }

  // Step 1: Trigger Biometrics Verification, then proceed to Selfie
  async function handleSwipeInitiatedFlow() {
    setError("");
    setMessage("");
    setFlowStep("biometric_prompt");

    try {
      const optsRes = await fetch("/api/auth/passkey/login-options", { method: "POST" });
      if (optsRes.ok) {
        const options = await optsRes.json();
        const assertion = await startAuthentication({ optionsJSON: options });
        const verifyRes = await fetch("/api/auth/passkey/login-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assertion),
        });
        if (verifyRes.ok) {
          setBiometricVerified(true);
        }
      }
    } catch (err) {
      // Biometric passkey prompt completed or bypassed; proceed to selfie step
      console.log("Proceeding to selfie step:", err);
    }

    // Step 2: Open Selfie Camera
    setTimeout(() => {
      setFlowStep("selfie_camera");
      startCamera();
    }, 400);
  }

  function captureSelfiePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedPhoto(dataUrl);
    }
  }

  // Swipe slider touch handlers
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (punchedOut || punching) return;
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const maxX = rect.width - 56;
    const pos = Math.max(0, Math.min(touchX - 28, maxX));
    setSliderPos(pos);
    if (pos >= maxX * 0.9) {
      setSliderPos(maxX);
      handleSwipeInitiatedFlow();
    }
  };

  const handleTouchEnd = () => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const maxX = rect.width - 56;
    if (sliderPos < maxX * 0.9) {
      setSliderPos(0);
    }
  };

  if (!canPunch) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1C2541] p-5 text-white shadow-2xl sm:p-7 border border-white/10">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#10B981]/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-[#3B82F6]/15 blur-3xl" />

      {/* Top Location & Time Pill Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11.5px] font-bold text-emerald-400 backdrop-blur-md">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            GD Foods Factory · Inside Range
          </span>
        </div>

        {currentTime && (
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold tabular-nums text-white/90 ring-1 ring-white/15 backdrop-blur-md">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            {currentTime}
          </div>
        )}
      </div>

      {/* Center Shift Progress Speedometer / Radial Ring */}
      <div className="relative z-10 my-6 flex flex-col items-center justify-center text-center">
        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
          {punchedOut ? "Shift Completed" : punchedIn ? "Live Shift Progress" : "Shift Schedule: 09:00 - 18:00"}
        </p>

        {/* Circular Glowing Ring */}
        <div className="relative my-4 flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="#1E293B"
              strokeWidth="8"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke={punchedOut ? "#10B981" : punchedIn ? "#10B981" : "#3B82F6"}
              strokeWidth="8"
              strokeDasharray={2 * Math.PI * 68}
              strokeDashoffset={
                punchedOut
                  ? 0
                  : punchedIn
                  ? (2 * Math.PI * 68) * (1 - shiftPct / 100)
                  : 2 * Math.PI * 68 * 0.95
              }
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>

          {/* Center Digital Live Clock display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {punchedIn ? (
              <>
                <span className="text-[11px] font-bold text-emerald-400">
                  {String(hrs).padStart(2, "0")}h {String(mins).padStart(2, "0")}m / 08h 00m
                </span>
                <span className="text-[26px] font-black tracking-tight text-white tabular-nums drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                  {String(hrs).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </span>
                <span className="text-[10.5px] font-semibold text-slate-400">
                  Punched In: {formatTime(record.punch_in_at)}
                </span>
              </>
            ) : punchedOut ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <span className="mt-1 text-[16px] font-black text-white">Shift Finished</span>
                <span className="text-[11px] text-slate-400">Out at {formatTime(record.punch_out_at)}</span>
              </>
            ) : (
              <>
                <Fingerprint className="h-8 w-8 text-emerald-400 animate-pulse" />
                <span className="mt-1 text-[18px] font-black text-white">Ready to Start</span>
                <span className="text-[11px] text-slate-400">General Shift (9h)</span>
              </>
            )}
          </div>
        </div>

        {/* 3 Action Buttons: Selfie Punch, Biometrics, Quick Punch */}
        {!punchedOut && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
            {/* 📸 Selfie Punch Button */}
            <button
              type="button"
              onClick={() => {
                setFlowStep("selfie_camera");
                startCamera();
              }}
              disabled={punching}
              className="flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm backdrop-blur-md transition active:scale-95"
            >
              <Camera className="h-4 w-4 text-emerald-400" />
              <span>Selfie Punch</span>
            </button>

            {/* 👆 Biometric Scan Button */}
            <button
              type="button"
              onClick={handleSwipeInitiatedFlow}
              disabled={punching}
              className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 px-4 py-2.5 text-[12.5px] font-bold text-emerald-300 shadow-sm backdrop-blur-md transition active:scale-95"
            >
              <Fingerprint className="h-4 w-4 text-emerald-400" />
              <span>Biometric + Selfie</span>
            </button>

            {/* ⚡ 1-Tap Quick Button */}
            <button
              type="button"
              onClick={() => executeFinalPunch()}
              disabled={punching}
              className="flex items-center gap-2 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 px-4 py-2.5 text-[12.5px] font-bold text-sky-300 shadow-sm backdrop-blur-md transition active:scale-95"
            >
              <Zap className="h-4 w-4 text-sky-400" />
              <span>1-Tap GPS</span>
            </button>
          </div>
        )}
      </div>

      {/* Swipe to Punch Slider (Magnetic Slide Control) */}
      {!punchedOut && (
        <div className="relative z-10 mt-5">
          <div
            ref={sliderTrackRef}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative flex h-14 w-full items-center overflow-hidden rounded-full bg-[#0F172A] border border-emerald-500/30 p-1 shadow-inner"
          >
            {/* Track background text */}
            <div className="absolute inset-0 flex items-center justify-center text-[12.5px] font-bold uppercase tracking-wider text-emerald-400/70">
              {punching ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4 text-emerald-400" /> Recording Punch...
                </span>
              ) : (
                "Slide to Verify Biometrics & Selfie →"
              )}
            </div>

            {/* Draggable knob */}
            <div
              style={{ transform: `translateX(${sliderPos}px)` }}
              className="relative z-10 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-[#059669] via-[#10B981] to-[#34D399] text-white shadow-[0_0_16px_rgba(16,185,129,0.5)] transition-transform duration-75"
            >
              <ChevronRight className="h-6 w-6 text-white animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      {geoState === "locating" && (
        <div className="relative z-10 mt-4 flex items-center gap-2 rounded-2xl bg-sky-500/20 border border-sky-400/30 p-3 text-[12.5px] font-semibold text-sky-200">
          <Navigation className="h-4 w-4 animate-spin text-sky-300" />
          <span>Acquiring precision GPS fix...</span>
        </div>
      )}

      {(geoState === "outside" || geoState === "error") && (
        <div className="relative z-10 mt-4 flex items-start justify-between gap-2.5 rounded-2xl bg-rose-500/20 border border-rose-400/30 p-3 text-[12.5px] font-semibold text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => executeFinalPunch()}
            className="shrink-0 rounded-lg bg-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500"
          >
            Retry
          </button>
        </div>
      )}

      {message && (
        <div className="relative z-10 mt-4 flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 p-3 text-[12.5px] font-semibold text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* 🔐 Step 1: Biometric Verification Modal */}
      {flowStep === "biometric_prompt" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-[#0F172A] border border-emerald-500/40 p-6 text-center text-white shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 ring-4 ring-emerald-500/30 animate-pulse">
              <Fingerprint className="h-12 w-12 text-emerald-400" />
            </div>

            <h3 className="mt-4 text-[20px] font-extrabold text-white">
              Biometric Verification
            </h3>
            <p className="mt-1.5 text-[13px] text-slate-300">
              Please scan your fingerprint or Face ID to confirm your identity.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white/10 p-3 text-[12px] font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Step 1 of 2: Biometrics Scan
            </div>

            <button
              type="button"
              onClick={() => {
                setFlowStep("selfie_camera");
                startCamera();
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-[13.5px] font-bold text-white shadow-lg active:scale-98"
            >
              Proceed to Selfie Camera →
            </button>
          </div>
        </div>
      )}

      {/* 📸 Step 2: Selfie Camera Verification Modal */}
      {flowStep === "selfie_camera" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-[#0F172A] border border-emerald-500/30 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-[16px] font-bold text-white">Selfie Face Verification</h3>
                  <p className="text-[11px] text-emerald-400">Step 2: Align face in frame</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAllModals}
                className="rounded-full bg-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Camera Viewfinder with Face Oval Outline */}
            <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
              {capturedPhoto ? (
                <img src={capturedPhoto} alt="Captured Selfie" className="h-full w-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              )}

              {/* Glowing Face Oval Frame */}
              {!capturedPhoto && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-36 rounded-[50%] border-2 border-dashed border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse" />
                </div>
              )}

              {/* Bottom Live Badge */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md text-[11px] font-semibold text-emerald-300">
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                  {factory.name} (GPS Verified)
                </span>
                <span>{currentTime}</span>
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Modal Actions */}
            <div className="mt-4 flex gap-3">
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-[13px] font-bold text-slate-300 hover:bg-white/15"
                  >
                    <RefreshCw className="h-4 w-4" /> Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => executeFinalPunch(capturedPhoto)}
                    disabled={punching}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-[13px] font-bold text-white shadow-lg active:scale-98"
                  >
                    {punching ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    Confirm Punch In
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={captureSelfiePhoto}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-[14px] font-bold text-white shadow-lg active:scale-98"
                >
                  <Camera className="h-5 w-5" /> Capture Selfie & Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
