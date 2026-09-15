"use client";

import { useEffect, useState } from "react";

/**
 * Checks if the current client environment is running inside the native
 * Android APK (WebView wrapper) or installed standalone PWA.
 */
export function checkIsNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  
  const hasAndroidBridge = Boolean((window as any).AndroidApp || (window as any).Android);
  const ua = navigator.userAgent || "";
  const isCustomUa =
    ua.includes("HRMateNativeApp") ||
    ua.includes("HRMateNative") ||
    ua.includes("com.gdfoods.hrmate");
  
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  return hasAndroidBridge || isCustomUa || isStandalone;
}

/**
 * React hook to reactively check if running inside native app wrapper.
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState<boolean>(false);

  useEffect(() => {
    setIsNative(checkIsNativeApp());
  }, []);

  return isNative;
}
