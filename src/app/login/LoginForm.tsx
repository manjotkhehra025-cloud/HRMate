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
  MapPin,
  CalendarDays,
  MessageSquare,
  Bell,
  Globe,
  ChevronDown,
  Check,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { classNames } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";

const REMEMBER_KEY = "hrmate_remember_email";

export default function LoginForm() {
  const router = useRouter();
  const { prefs, savePrefs } = usePrefs();
  const [mode, setMode] = useState<"password" | "passkey">("password");
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
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyLogin() {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const optsRes = await fetch("/api/auth/passkey/login-options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start passkey login");
      const options = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.error || "Passkey authentication failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Passkey authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: MapPin, label: "GPS punch in & out" },
    { icon: CalendarDays, label: "Leaves & balances" },
    { icon: MessageSquare, label: "Team social wall" },
    { icon: Bell, label: "Push notifications" },
  ];

  const field =
    "h-12 w-full rounded-full border border-[#D5DEE8] bg-white pl-11 pr-4 text-[14px] text-[#172334] outline-none placeholder:text-[#9AA8B8] focus:border-[#1E6FE0]";

  return (
    <div className="login-light h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-[#F4F7FB] lg:overflow-hidden lg:p-4">
      <div className="flex min-h-full min-w-0 flex-col bg-white lg:h-full lg:flex-row lg:overflow-hidden lg:rounded-[24px] lg:shadow-[0_8px_40px_rgba(11,37,69,0.12)]">
        {/* Left brand panel */}
        <aside className="flow-gradient relative hidden w-[46%] shrink-0 flex-col overflow-hidden px-12 pb-8 pt-10 text-white lg:flex">
          <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full border-[28px] border-white/10" />
          <div className="pointer-events-none absolute -right-8 top-28 h-56 w-56 rounded-full border-[20px] border-white/10" />

          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/20 ring-1 ring-white/30">
              <Fingerprint className="h-7 w-7 text-white" />
            </span>
            <div>
              <p className="text-[22px] font-bold leading-none tracking-tight">HRMate</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Smart HRMS</p>
            </div>
          </div>

          <div className="relative mt-14 max-w-[22rem]">
            <h1 className="text-[40px] font-bold leading-[1.12] tracking-tight">
              Attendance, leaves and your team — in one place.
            </h1>
            <span className="mt-5 block h-[3px] w-12 rounded-full bg-[#16B878]" />
            <p className="mt-5 text-[15px] leading-relaxed text-white/85">
              Simplify HR processes, empower your team, and make smarter decisions every day.
            </p>
            <ul className="mt-8 space-y-3.5">
              {features.map((f) => (
                <li key={f.label} className="flex items-center gap-3 text-[15px] font-medium">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/18 ring-1 ring-white/25">
                    <f.icon className="h-[18px] w-[18px]" />
                  </span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>

          <PreviewCards />
        </aside>

        {/* Right form */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#F7FAFC] lg:h-full lg:overflow-y-auto">
          <div className="absolute right-4 top-[max(12px,env(safe-area-inset-top))] z-10 lg:right-8 lg:top-6">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-[#D5DEE8] bg-white px-3 text-[13px] font-medium text-[#172334] shadow-sm"
            >
              <Globe className="h-3.5 w-3.5 text-[#617083]" />
              {prefs.language === "pa" ? "ਪੰਜਾਬੀ" : "English"}
              <ChevronDown className="h-3.5 w-3.5 text-[#617083]" />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-1 w-36 overflow-hidden rounded-[12px] border border-[#DDE6EF] bg-white py-1 shadow-[0_7px_24px_rgba(11,37,69,0.14)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#172334] hover:bg-[#F4F7FB]"
                  onClick={() => {
                    savePrefs({ language: "en" });
                    setLangOpen(false);
                  }}
                >
                  English {prefs.language === "en" && <Check className="h-3.5 w-3.5 text-[#1E6FE0]" />}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#172334] hover:bg-[#F4F7FB]"
                  onClick={() => {
                    savePrefs({ language: "pa" });
                    setLangOpen(false);
                  }}
                >
                  ਪੰਜਾਬੀ {prefs.language === "pa" && <Check className="h-3.5 w-3.5 text-[#1E6FE0]" />}
                </button>
              </div>
            )}
          </div>

          <header className="flow-gradient px-5 pb-6 pt-[max(52px,calc(env(safe-area-inset-top)+44px))] text-white lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/20 ring-1 ring-white/30">
                <Fingerprint className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[18px] font-bold leading-none">HRMate</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Smart HRMS</p>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col items-center px-4 py-5 pb-[max(16px,env(safe-area-inset-bottom))] lg:justify-center lg:px-10 lg:py-10">
            <div className="login-card w-full max-w-[440px] rounded-[22px] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(11,37,69,0.08)] lg:px-10 lg:py-9">
              <div className="text-center">
                <h2 className="text-[28px] font-bold tracking-tight text-[#172334]">Welcome back</h2>
                <p className="mt-1.5 text-[14px] text-[#8A97A8]">Sign in to your workspace</p>
              </div>

              <div className="mx-auto mt-6 grid max-w-[320px] grid-cols-2 gap-1 rounded-full bg-[#EEF3F8] p-1">
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={classNames(
                    "h-10 rounded-full text-[13px] font-semibold",
                    mode === "password" ? "bg-white text-[#1E6FE0] shadow-sm" : "bg-transparent text-[#8A97A8]"
                  )}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMode("passkey")}
                  className={classNames(
                    "h-10 rounded-full text-[13px] font-semibold",
                    mode === "passkey" ? "bg-white text-[#1E6FE0] shadow-sm" : "bg-transparent text-[#8A97A8]"
                  )}
                >
                  Passkey
                </button>
              </div>

              {mode === "password" ? (
                <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#172334]" htmlFor="email">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="username"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className={field}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-[13px] font-medium text-[#172334]" htmlFor="password">
                        Password
                      </label>
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-[#1E6FE0]"
                        onClick={() => {
                          setError("");
                          setInfo("Ask Super Admin to reset your password in Admin → Users.");
                        }}
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
                      <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className={field}
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#172334]">
                    <span
                      className={classNames(
                        "flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border",
                        remember ? "border-[#1E6FE0] bg-[#1E6FE0]" : "border-[#C9D5E2] bg-white"
                      )}
                    >
                      {remember && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember me
                  </label>

                  {error && <p className="rounded-[11px] bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>}
                  {info && <p className="rounded-[11px] bg-[#E7F1FF] px-3 py-2.5 text-sm text-[#1556B8]">{info}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#1E6FE0] text-[15px] font-semibold text-white disabled:opacity-50"
                  >
                    {loading ? <Spinner className="h-4 w-4" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              ) : (
                <div className="mt-6 space-y-4">
                  {error && <p className="rounded-[11px] bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>}
                </div>
              )}

              <div className="mt-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#E6EEF5]" />
                <span className="text-[12px] text-[#8A97A8]">or</span>
                <span className="h-px flex-1 bg-[#E6EEF5]" />
              </div>

              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={loading}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-[#D5DEE8] bg-white text-[15px] font-semibold text-[#1E6FE0] disabled:opacity-50"
              >
                {loading ? <Spinner className="h-4 w-4" /> : <><Fingerprint className="h-5 w-5" /> Login with Biometrics</>}
              </button>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#16B878]">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure workspace
              </p>
            </div>

            <p className="mt-5 text-center text-[13px] text-[#8A97A8]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-semibold text-[#1E6FE0]"
                onClick={() => {
                  setError("");
                  setInfo("New accounts are created by Super Admin in Admin → Users.");
                }}
              >
                Contact your HR administrator
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCards() {
  return (
    <div className="relative mt-auto h-[210px] w-full max-w-[420px] shrink-0">
      <div className="absolute bottom-0 left-[18%] w-[210px] rotate-[-8deg] rounded-[18px] bg-white p-3.5 text-[#172334] shadow-[0_12px_30px_rgba(8,28,51,0.22)]">
        <p className="text-[11px] font-medium text-[#8A97A8]">Present Today</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-[28px] font-bold leading-none">186</p>
          <p className="text-[10px] font-semibold text-[#16B878]">↑ 8.5% than yesterday</p>
        </div>
        <svg viewBox="0 0 120 28" className="mt-2 h-8 w-full" preserveAspectRatio="none">
          <polyline fill="none" stroke="#16B878" strokeWidth="2.2" points="0,20 18,16 36,18 54,10 72,14 90,6 120,8" />
        </svg>
      </div>
      <div className="absolute bottom-6 right-0 w-[168px] rotate-[7deg] rounded-[18px] bg-white p-3.5 text-[#172334] shadow-[0_12px_30px_rgba(8,28,51,0.22)]">
        <p className="text-[11px] font-medium text-[#8A97A8]">On Leave</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-[28px] font-bold leading-none">18</p>
          <p className="text-[10px] font-semibold text-[#E11D48]">↓ 2.4% than yesterday</p>
        </div>
        <svg viewBox="0 0 100 24" className="mt-2 h-7 w-full" preserveAspectRatio="none">
          <polyline fill="none" stroke="#F5A623" strokeWidth="2.2" points="0,14 20,10 40,16 60,8 80,12 100,6" />
        </svg>
      </div>
      <div className="absolute -bottom-2 left-0 w-[230px] rotate-[-4deg] rounded-[18px] bg-white p-3.5 text-[#172334] shadow-[0_12px_30px_rgba(8,28,51,0.22)]">
        <p className="text-[12px] font-semibold">Attendance Overview</p>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#E8EEF4" strokeWidth="5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#16B878" strokeWidth="5" strokeDasharray="66 88" strokeLinecap="round" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#E11D48" strokeWidth="5" strokeDasharray="15 88" strokeDashoffset="-66" strokeLinecap="round" />
          </svg>
          <div className="space-y-1 text-[11px]">
            <p className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#16B878]" /> Present{" "}
              <span className="font-semibold">186 (75%)</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#E11D48]" /> Absent{" "}
              <span className="font-semibold">42 (17%)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
