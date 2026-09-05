"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Globe,
  ChevronDown,
  Check,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { usePrefs } from "@/components/PrefsProvider";

const REMEMBER_KEY = "hrmate_remember_email";
const BIOMETRIC_TOKEN_KEY = "hrmate_biometric_token";

export default function LoginForm() {
  const router = useRouter();
  const { prefs, savePrefs } = usePrefs();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        return;
      }

      try {
        localStorage.setItem(REMEMBER_KEY, email.trim());
        if (data.biometricToken) {
          localStorage.setItem(BIOMETRIC_TOKEN_KEY, data.biometricToken);
        }
      } catch {
        /* ignore */
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong during login");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    setLoading(true);
    setError("");
    setInfo("");

    const rememberedEmail = email.trim() || (typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) : null);
    const rememberedToken = typeof window !== "undefined" ? localStorage.getItem(BIOMETRIC_TOKEN_KEY) : null;

    // 1. If running inside Native Android App, trigger real Android BiometricPrompt dialog!
    if (
      typeof window !== "undefined" &&
      (window as any).AndroidApp &&
      typeof (window as any).AndroidApp.authenticateBiometrics === "function"
    ) {
      if (!rememberedEmail || !rememberedToken) {
        setLoading(false);
        setError("Please sign in with password once to link your fingerprint.");
        return;
      }

      (window as any).onNativeBiometricResult = async (success: boolean, msg: string) => {
        if (success) {
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: rememberedEmail,
                biometricToken: rememberedToken,
              }),
            });
            const data = await res.json();
            if (res.ok) {
              if (data.biometricToken) {
                localStorage.setItem(BIOMETRIC_TOKEN_KEY, data.biometricToken);
              }
              router.push("/dashboard");
              router.refresh();
              return;
            } else {
              setError("Please sign in with password once to refresh your fingerprint link.");
            }
          } catch {
            setError("Connection failed. Please try again.");
          }
        } else {
          setError(msg === "failed" ? "Fingerprint not recognized" : msg || "Biometric authentication cancelled");
        }
        setLoading(false);
      };

      (window as any).AndroidApp.authenticateBiometrics();
      return;
    }

    // 2. WebAuthn Passkeys fallback
    try {
      if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
      ) {
        const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (isAvailable) {
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
              router.push("/dashboard");
              router.refresh();
              return;
            }
          }
        }
      }

      // 3. Saved device biometric token fallback
      if (rememberedEmail && rememberedToken) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: rememberedEmail,
            biometricToken: rememberedToken,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.biometricToken) {
            localStorage.setItem(BIOMETRIC_TOKEN_KEY, data.biometricToken);
          }
          router.push("/dashboard");
          router.refresh();
          return;
        }
      }

      setError("Please sign in with password once to link your fingerprint to this device.");
    } catch {
      setError("Please sign in with password once to link your fingerprint to this device.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col items-center justify-center bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1C2541] p-4 sm:p-6 lg:p-8">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-80 w-80 rounded-full bg-[#10B981]/15 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-[#3B82F6]/15 blur-3xl" />

      {/* Language Picker in top right corner */}
      <div className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-20 sm:right-8 sm:top-6">
        <button
          type="button"
          onClick={() => setLangOpen((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 text-[13px] font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/15"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          {prefs.language === "pa" ? "ਪੰਜਾਬੀ" : prefs.language === "hi" ? "हिन्दी" : "English"}
          <ChevronDown className="h-3.5 w-3.5 text-white/70" />
        </button>
        {langOpen && (
          <div className="absolute right-0 mt-1.5 w-36 overflow-hidden rounded-2xl border border-white/15 bg-[#0F172A] py-1 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-white/10"
              onClick={() => {
                savePrefs({ language: "en" });
                setLangOpen(false);
              }}
            >
              English {prefs.language === "en" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-white/10"
              onClick={() => {
                savePrefs({ language: "pa" });
                setLangOpen(false);
              }}
            >
              ਪੰਜਾਬੀ {prefs.language === "pa" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-white/10"
              onClick={() => {
                savePrefs({ language: "hi" });
                setLangOpen(false);
              }}
            >
              हिन्दी {prefs.language === "hi" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
          </div>
        )}
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-[32px] border border-white/20 bg-white p-6 shadow-2xl sm:p-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#059669] via-[#10B981] to-[#34D399] text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] ring-4 ring-emerald-500/20">
            <Fingerprint className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-3 text-[22px] font-black tracking-tight text-[#0F172A]">HRMate</h1>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#059669]">
            GD Foods Mfg. (I) Pvt. Ltd. · Workforce Portal
          </p>
        </div>

        {/* 1-Tap Biometric Login Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={loading}
            className="group relative flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#059669] via-[#10B981] to-[#047857] py-3.5 text-[14.5px] font-extrabold text-white shadow-[0_6px_24px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400/30 transition-all hover:opacity-95 active:scale-98"
          >
            {loading ? (
              <Spinner className="h-5 w-5 text-white" />
            ) : (
              <>
                <Fingerprint className="h-5 w-5 text-white transition-transform group-hover:scale-110" />
                <span>Login with Biometrics / Fingerprint</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#E2E8F0]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">or with password</span>
          <span className="h-px flex-1 bg-[#E2E8F0]" />
        </div>

        {/* Password Login Form */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-[13px] font-bold text-[#0F172A]" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@hrmate.com"
                className="h-12 w-full rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] pl-11 pr-4 text-[15px] font-semibold text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#10B981] focus:bg-white focus:ring-4 focus:ring-[#10B981]/15 transition"
                style={{ color: "#0F172A", WebkitTextFillColor: "#0F172A" }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[13px] font-bold text-[#0F172A]" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                className="text-[12px] font-bold text-[#10B981] hover:underline"
                onClick={() => {
                  setError("");
                  setInfo("Contact Super Admin to reset your password.");
                }}
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-12 w-full rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] pl-11 pr-4 text-[15px] font-semibold text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#10B981] focus:bg-white focus:ring-4 focus:ring-[#10B981]/15 transition"
                style={{ color: "#0F172A", WebkitTextFillColor: "#0F172A" }}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-[#475569]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#10B981] focus:ring-[#10B981]"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me on this device
          </label>

          {error && (
            <p className="rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-700">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-[12.5px] font-semibold text-emerald-800">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F172A] text-[14.5px] font-bold text-white shadow-md transition active:scale-98 hover:bg-[#1E293B]"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <>Sign In with Password <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#059669]">
          <ShieldCheck className="h-3.5 w-3.5" /> End-to-end encrypted workspace
        </p>
      </div>

      <p className="relative z-10 mt-5 text-center text-[12.5px] font-medium text-slate-400">
        New employee? Contact your HR Manager at GD Foods
      </p>
    </div>
  );
}
