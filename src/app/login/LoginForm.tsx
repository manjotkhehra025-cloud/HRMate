"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { classNames } from "@/lib/utils";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "passkey">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
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
    { icon: <MapPin className="h-4 w-4" />, label: "Geofenced GPS punch in & out" },
    { icon: <CalendarDays className="h-4 w-4" />, label: "Leave balances & applications" },
    { icon: <MessageSquare className="h-4 w-4" />, label: "Social wall for your team" },
    { icon: <Bell className="h-4 w-4" />, label: "Real-time push notifications" },
  ];

  return (
    <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-page lg:flex lg:min-h-full">
      {/* Desktop brand panel */}
      <div className="flow-gradient relative hidden w-[48%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-16 top-8 h-[28rem] w-[28rem] rounded-full border-[48px] border-white/10" />
        <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-2/5 w-full bg-navy/25" style={{ clipPath: "polygon(18% 100%, 100% 38%, 100% 100%)" }} />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <Fingerprint className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="block text-xl font-bold tracking-tight text-white">
              HR<span className="text-brand-200">Mate</span>
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
              Smart HRMS
            </span>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-[2.15rem] font-bold leading-[1.15] text-white text-balance">
            One platform for your entire workforce.
          </h1>
          <div className="mt-10 space-y-3.5">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-[14px] font-medium text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/12 ring-1 ring-white/20">
                  {f.icon}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} HRMate · Shop floor and office
        </p>
      </div>

      {/* Form column */}
      <div className="flex w-full min-w-0 flex-col lg:w-[52%] lg:justify-center">
        {/* Mobile hero — compact, form never climbs over Welcome */}
        <div className="flow-gradient relative overflow-hidden px-5 pb-8 pt-[max(1.1rem,env(safe-area-inset-top))] lg:hidden">
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -left-10 bottom-4 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <Fingerprint className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="block text-lg font-bold text-white">
                HR<span className="text-brand-200">Mate</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/65">
                Smart HRMS
              </span>
            </div>
          </div>
          <h1 className="relative mt-5 text-[1.7rem] font-bold leading-tight text-white">Welcome back</h1>
          <p className="relative mt-1.5 text-[13.5px] text-white/80">Sign in to punch in and get to work.</p>
          <svg
            className="pointer-events-none absolute -bottom-px left-0 w-full text-page"
            viewBox="0 0 400 28"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path fill="currentColor" d="M0 28C80 4 320 4 400 28H0Z" />
          </svg>
        </div>

        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 lg:flex lg:w-full lg:justify-center lg:px-10 lg:py-12">
          <div className="card mx-auto w-full max-w-[22.5rem] p-5 shadow-pop lg:max-w-[24rem] lg:p-8">
            <div className="hidden text-center lg:block">
              <h2 className="text-[1.65rem] font-bold tracking-tight text-ink">Welcome back</h2>
              <p className="mt-1 text-[13.5px] text-muted">Sign in to your workspace</p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-full bg-[#EEF3F8] p-1 lg:mt-6">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={classNames(
                  "rounded-full py-2.5 text-[13px] font-semibold transition",
                  mode === "password" ? "bg-white text-ink shadow-sm" : "text-muted"
                )}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode("passkey")}
                className={classNames(
                  "rounded-full py-2.5 text-[13px] font-semibold transition",
                  mode === "passkey" ? "bg-white text-ink shadow-sm" : "text-muted"
                )}
              >
                Passkey
              </button>
            </div>

            {mode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="mt-5 space-y-3.5">
                <div>
                  <label className="label sr-only lg:not-sr-only" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="username"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="input pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="label sr-only lg:not-sr-only" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input pl-10"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn-primary h-12 w-full text-[15px]">
                  {loading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      Sign in <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-[15px] border border-line bg-page p-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[14px] bg-brand-50">
                    <Fingerprint className="h-7 w-7 text-brand-600" />
                  </div>
                  <p className="text-sm font-semibold text-ink">Use your device passkey</p>
                  <p className="mt-1 text-xs text-muted">Face ID, fingerprint, Windows Hello or a security key</p>
                </div>
                {error && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>
                )}
                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="btn-primary h-12 w-full text-[15px]"
                >
                  {loading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      Authenticate with passkey <Fingerprint className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-flow-deep">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
