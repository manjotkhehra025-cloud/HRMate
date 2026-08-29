"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushRegistration({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"unsupported" | "denied" | "enabled" | "loading" | "idle">(
    "idle"
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setState("enabled");
    } else if (Notification.permission === "denied") {
      setState("denied");
    } else {
      setState("idle");
    }
  }, []);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("enabled");
    } catch (e) {
      console.error(e);
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (state === "enabled") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <BellRing className="h-3.5 w-3.5" /> Push on
      </span>
    );
  }
  if (state === "denied") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Bell className="h-3.5 w-3.5" /> Notifications blocked
      </span>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
    >
      <Bell className="h-3.5 w-3.5" />
      {state === "loading" ? "Enabling…" : "Enable notifications"}
    </button>
  );
}
