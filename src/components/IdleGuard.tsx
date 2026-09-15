"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut, CheckCircle2 } from "lucide-react";

const DEFAULT_IDLE_MINUTES = 30; // 30 minutes
const WARNING_SECONDS = 60; // 60s countdown warning before auto-logout

export default function IdleGuard() {
  const router = useRouter();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const loggingOutRef = useRef(false);

  // Read idle duration from localStorage
  const getIdleMs = () => {
    try {
      const saved = localStorage.getItem("hrmate_auto_logout_mins");
      if (saved === "never") return null; // never auto logout
      const mins = saved ? parseInt(saved, 10) : DEFAULT_IDLE_MINUTES;
      return (mins || DEFAULT_IDLE_MINUTES) * 60 * 1000;
    } catch {
      return DEFAULT_IDLE_MINUTES * 60 * 1000;
    }
  };

  const signOut = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  };

  const resetIdleTimer = () => {
    lastActivityRef.current = Date.now();
    setWarningOpen(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const idleMs = getIdleMs();
    if (!idleMs) return; // disabled

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Trigger warning 60 seconds before full timeout
    const warningMs = Math.max(10_000, idleMs - WARNING_SECONDS * 1000);

    idleTimeoutRef.current = setTimeout(() => {
      setWarningOpen(true);
      setSecondsLeft(WARNING_SECONDS);

      let remaining = WARNING_SECONDS;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          signOut();
        }
      }, 1000);
    }, warningMs);
  };

  useEffect(() => {
    resetIdleTimer();

    const evs = ["pointerdown", "keydown", "touchstart", "scroll", "click"] as const;
    const handleActivity = () => {
      // Only reset if warning is NOT currently showing (so user can see warning modal)
      if (!warningOpen) {
        const now = Date.now();
        if (now - lastActivityRef.current > 5000) {
          resetIdleTimer();
        }
      }
    };

    evs.forEach((e) => document.addEventListener(e, handleActivity, { passive: true, capture: true }));

    const onVis = () => {
      if (document.visibilityState === "visible") {
        const idleMs = getIdleMs();
        if (idleMs && Date.now() - lastActivityRef.current > idleMs) {
          signOut();
        } else {
          resetIdleTimer();
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      evs.forEach((e) => document.removeEventListener(e, handleActivity, true));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [warningOpen]);

  if (!warningOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl text-center dark:border-[#1E293B] dark:bg-[#0F172A]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-4 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-900/40">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h3 className="mt-4 text-[18px] font-black text-[#0F172A] dark:text-white">
          Inactivity Warning
        </h3>
        <p className="mt-1.5 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          You have been idle. For security, your session will automatically log out in:
        </p>

        {/* Big Countdown Timer */}
        <div className="my-4 rounded-2xl bg-[#F8FAFC] py-3 text-[32px] font-black tabular-nums text-[#EF4444] ring-1 ring-[#CBD5E1] dark:bg-[#0B132B] dark:ring-[#334155]">
          00:{String(Math.max(0, secondsLeft)).padStart(2, "0")}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={resetIdleTimer}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E6FE0] py-3 text-[13.5px] font-bold text-white shadow-md hover:bg-[#1556B8] active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4" /> Stay Logged In
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F1F5F9] py-2.5 text-[13px] font-bold text-[#64748B] hover:bg-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8]"
          >
            <LogOut className="h-4 w-4" /> Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
