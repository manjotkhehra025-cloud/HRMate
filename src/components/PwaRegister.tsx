"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Post ready notification to native Flutter/Android WebView bridge
    try {
      if (typeof window !== "undefined") {
        if ((window as any).HRMateReady && typeof (window as any).HRMateReady.postMessage === "function") {
          (window as any).HRMateReady.postMessage("ready");
        }
        if ((window as any).AndroidApp && typeof (window as any).AndroidApp.onAppReady === "function") {
          (window as any).AndroidApp.onAppReady();
        }
      }
    } catch (_) {}
  }, []);

  return null;
}
