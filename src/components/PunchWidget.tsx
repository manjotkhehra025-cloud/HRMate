"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  ChevronRight,
  RefreshCw,
  X,
  Smartphone,
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Flow & Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Format Elapsed Hours & Minutes
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
        () => reject(new Error("Location permission denied. Please enable GPS.")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  // Camera Management - Clean Single Stream Initialization
  const openSelfieCamera = async () => {
    setCapturedPhoto(null);
    setCameraError("");
    setCameraModalOpen(true);
    setCameraLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.log("Play failed:", playErr);
        }
      }
    } catch (e: any) {
      console.warn("Front camera constraint failed, trying basic video:", e);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setCameraStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (fallbackErr: any) {
        setCameraError("Live camera unavailable. Tap 'Open Phone Camera' below to take a photo.");
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // Video Ref callback to attach stream instantly upon DOM mount
  const setVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && cameraStream) {
        node.srcObject = cameraStream;
        node.play().catch(() => {});
      }
    },
    [cameraStream]
  );

  function closeCameraModal() {
    stopCamera();
    setCameraModalOpen(false);
    setCapturedPhoto(null);
    setSliderPos(0);
    setCameraError("");
  }

  // Final Execution of Punch (with GPS + Selfie)
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
        setError(data.error || "Failed to record punch");
        return;
      }
      setRecord(data.record);
      setGeoState("idle");
      const action = data.record.punch_out_at ? "Punched out" : "Punched in";
      setMessage(`${action} successfully at ${formatTime(Date.now())} ✓`);
      window.dispatchEvent(new Event(ATTENDANCE_EVENT));
      router.refresh();
      closeCameraModal();
    } catch (e: any) {
      setGeoState("error");
      setError(e.message || "Failed to acquire GPS location");
    } finally {
      setPunching(false);
      setSliderPos(0);
    }
  }

  function captureSelfiePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  }

  // Native phone camera input fallback
  const handleNativeFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setCapturedPhoto(ev.target.result as string);
          stopCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
      openSelfieCamera();
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

  const facilityLabel = factory.name || "GD Foods Factory";

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1C2541] p-5 text-white shadow-2xl sm:p-7 border border-white/10">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#10B981]/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-[#3B82F6]/15 blur-3xl" />

      {/* Top Facility & Time Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11.5px] font-bold text-emerald-400 backdrop-blur-md">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            {facilityLabel} · Geofence Verified
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

          {/* Center Display */}
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
                <Camera className="h-8 w-8 text-emerald-400 animate-pulse" />
                <span className="mt-1 text-[18px] font-black text-white">Selfie Punch In</span>
                <span className="text-[11px] text-slate-400">General Shift (9h)</span>
              </>
            )}
          </div>
        </div>

        {/* 1 Primary Action Button: Selfie Camera Punch */}
        {!punchedOut && (
          <div className="flex items-center justify-center mt-1">
            <button
              type="button"
              onClick={openSelfieCamera}
              disabled={punching}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400/30 transition active:scale-95 hover:opacity-95"
            >
              <Camera className="h-5 w-5 text-white" />
              <span>{punchedIn ? "📸 Capture Selfie Punch Out" : "📸 Capture Selfie Punch In"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Swipe to Punch Slider */}
      {!punchedOut && (
        <div className="relative z-10 mt-5">
          <div
            ref={sliderTrackRef}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative flex h-14 w-full items-center overflow-hidden rounded-full bg-[#0F172A] border border-emerald-500/30 p-1 shadow-inner"
          >
            <div className="absolute inset-0 flex items-center justify-center pl-10 pr-4 text-[12px] font-bold uppercase tracking-wider text-emerald-400/90 text-center select-none">
              {punching ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4 text-emerald-400" /> Recording...
                </span>
              ) : (
                "Slide to Selfie Punch →"
              )}
            </div>

            <div
              style={{ transform: `translateX(${sliderPos}px)` }}
              className="relative z-10 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-[#059669] via-[#10B981] to-[#34D399] text-white shadow-[0_0_16px_rgba(16,185,129,0.5)] transition-transform duration-75"
            >
              <ChevronRight className="h-6 w-6 text-white animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {geoState === "locating" && (
        <div className="relative z-10 mt-4 flex items-center gap-2 rounded-2xl bg-sky-500/20 border border-sky-400/30 p-3 text-[12.5px] font-semibold text-sky-200">
          <Navigation className="h-4 w-4 animate-spin text-sky-300" />
          <span>Verifying factory GPS position...</span>
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
            onClick={openSelfieCamera}
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

      {/* 📸 Clean Selfie Camera Verification Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-[#0F172A] border border-emerald-500/30 p-5 text-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-[16px] font-bold text-white">Selfie Face Verification</h3>
                  <p className="text-[11px] text-emerald-400">Align face inside the oval</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCameraModal}
                className="rounded-full bg-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Hidden canvas & native camera input */}
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={nativeFileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleNativeFileCapture}
            />

            {/* Camera Viewfinder */}
            <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl bg-black border border-white/10">
              {capturedPhoto ? (
                <img src={capturedPhoto} alt="Captured Selfie" className="h-full w-full object-cover" />
              ) : (
                <video
                  ref={setVideoElement}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  preload="auto"
                  style={{ transform: "scaleX(-1)", objectFit: "cover" }}
                  className="h-full w-full object-cover pointer-events-none"
                />
              )}

              {/* Glowing Face Oval Frame */}
              {!capturedPhoto && !cameraError && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-52 w-40 rounded-[50%] border-2 border-dashed border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.5)] animate-pulse" />
                </div>
              )}

              {/* Fallback Camera Screen if browser stream error */}
              {cameraError && !capturedPhoto && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-900/90">
                  <Smartphone className="h-10 w-10 text-emerald-400 mb-2" />
                  <p className="text-[13px] text-slate-200">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => nativeFileInputRef.current?.click()}
                    className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-md active:scale-95"
                  >
                    <Camera className="h-4 w-4" /> Open Phone Camera
                  </button>
                </div>
              )}

              {/* Bottom Live Watermark Badge */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-xl bg-black/70 px-3 py-1.5 backdrop-blur-md text-[11px] font-semibold text-emerald-300">
                <span className="flex items-center gap-1 truncate max-w-[220px]">
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">{facilityLabel}</span>
                </span>
                <span className="shrink-0">{currentTime}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex flex-col gap-2.5">
              {capturedPhoto ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedPhoto(null);
                      openSelfieCamera();
                    }}
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
                    Confirm Punch
                  </button>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={captureSelfiePhoto}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-[14px] font-bold text-white shadow-lg active:scale-98"
                  >
                    <Camera className="h-5 w-5" /> Capture Selfie &amp; Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => nativeFileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3.5 py-3 text-[12.5px] font-semibold text-slate-200 border border-white/10"
                    title="Open device camera directly"
                  >
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
