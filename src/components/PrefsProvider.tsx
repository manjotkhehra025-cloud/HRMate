"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { t as translate, type I18nKey, type Lang } from "@/lib/i18n";

type Appearance = "light" | "dark" | "system";
type TextSize = "small" | "medium" | "large";

type PrefsState = {
  language: Lang;
  appearance: Appearance;
  text_size: TextSize;
  notify_enabled: number;
};

const DEFAULTS: PrefsState = {
  language: "en",
  appearance: "system",
  text_size: "medium",
  notify_enabled: 1,
};

function readLocal(): PrefsState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return {
      language: localStorage.getItem("hrmate_language") === "pa" ? "pa" : "en",
      appearance: (localStorage.getItem("hrmate_appearance") as Appearance) || "system",
      text_size: (localStorage.getItem("hrmate_text_size") as TextSize) || "medium",
      notify_enabled: localStorage.getItem("hrmate_notify") === "0" ? 0 : 1,
    };
  } catch {
    return DEFAULTS;
  }
}

function resolvedTheme(appearance: Appearance): "light" | "dark" {
  if (appearance === "light" || appearance === "dark") return appearance;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyPrefsDom(prefs: PrefsState) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolvedTheme(prefs.appearance));
  root.setAttribute("data-text", prefs.text_size);
  root.lang = prefs.language === "pa" ? "pa" : "en";
  try {
    localStorage.setItem("hrmate_language", prefs.language);
    localStorage.setItem("hrmate_appearance", prefs.appearance);
    localStorage.setItem("hrmate_text_size", prefs.text_size);
    localStorage.setItem("hrmate_notify", String(prefs.notify_enabled));
  } catch {
    /* ignore */
  }
}

type Ctx = {
  prefs: PrefsState;
  t: (key: I18nKey) => string;
  savePrefs: (patch: Partial<PrefsState>) => Promise<void>;
};

const PrefsContext = createContext<Ctx>({
  prefs: DEFAULTS,
  t: (key) => translate("en", key),
  savePrefs: async () => {},
});

export function usePrefs() {
  return useContext(PrefsContext);
}

export default function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULTS);

  useEffect(() => {
    const local = readLocal();
    setPrefs(local);
    applyPrefsDom(local);
    let cancelled = false;
    fetch("/api/profile/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.prefs) return;
        const next: PrefsState = {
          language: d.prefs.language === "pa" ? "pa" : "en",
          appearance:
            d.prefs.appearance === "dark" || d.prefs.appearance === "light" ? d.prefs.appearance : "system",
          text_size:
            d.prefs.text_size === "small" || d.prefs.text_size === "large" ? d.prefs.text_size : "medium",
          notify_enabled: d.prefs.notify_enabled ? 1 : 0,
        };
        setPrefs(next);
        applyPrefsDom(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prefs.appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPrefsDom(prefs);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  const savePrefs = useCallback(async (patch: Partial<PrefsState>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      applyPrefsDom(next);
      return next;
    });
    try {
      await fetch("/api/profile/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* keep local */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      prefs,
      t: (key) => translate(prefs.language, key),
      savePrefs,
    }),
    [prefs, savePrefs]
  );

  return (
    <PrefsContext.Provider value={value}>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </PrefsContext.Provider>
  );
}
