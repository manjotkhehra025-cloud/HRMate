"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      Promise.all(regs.map((r) => r.update())).catch(() => {});
    });
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
