"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IDLE_MS } from "@/lib/auth-idle";

export default function IdleGuard() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPing = useRef(0);
  const loggingOut = useRef(false);

  useEffect(() => {
    async function signOut() {
      if (loggingOut.current) return;
      loggingOut.current = true;
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        /* still leave */
      }
      router.push("/login");
      router.refresh();
    }

    function ping() {
      const now = Date.now();
      if (now - lastPing.current < 30_000) return;
      lastPing.current = now;
      fetch("/api/auth/ping", { method: "POST", cache: "no-store" })
        .then((r) => {
          if (r.status === 401) signOut();
        })
        .catch(() => {});
    }

    function bump() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(signOut, IDLE_MS);
      ping();
    }

    bump();
    const evs = ["pointerdown", "keydown", "touchstart", "scroll", "click"] as const;
    evs.forEach((e) => document.addEventListener(e, bump, { passive: true, capture: true }));
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      evs.forEach((e) => document.removeEventListener(e, bump, true));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  return null;
}
