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
    <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto lg:flex lg:min-h-full">
      {/* Desktop brand panel */}
      <div className="flow-gradient relative hidden w-[48%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-flow/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-glow backdrop-blur">
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

        <div className="relative animate-fade-in">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">
            Your workplace, in one tap
          </p>
          <h1 className="mt-3 max-w-md text-4xl font-bold leading-tight text-white text-balance">
            One platform for your entire workforce.
          </h1>
          <p className="mt-4 max-w-md text-base text-white/80">
            GPS attendance, leave management, a social wall and approval workflows — all in one
            beautiful place.
          </p>

          <div className="mt-10 space-y-3">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm text-white/95">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
                  {f.icon}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} HRMate · Built for the shop floor and the office
        </p>
      </div>

      {/* Form column */}
      <div className="flex w-full flex-col bg-transparent lg:w-[52%]">
        {/* Mobile hero */}
        <div className="flow-gradient relative overflow-hidden px-5 py-6 lg:hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Fingerprint className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="block text-lg font-bold text-white">
                HR<span className="text-brand-200">Mate</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/60">
                Smart HRMS
              </span>
            </div>
          </div>
          <h1 className="relative mt-4 text-2xl font-bold leading-tight text-white">
            Welcome back
          </h1>
          <p className="relative mt-1.5 text-sm text-white/75">Sign in to punch in and get to work.</p>
        </div>

        <div className="px-4 py-5 pb-10 lg:flex lg:flex-1 lg:items-center lg:justify-center lg:px-8 lg:py-12">
          <div className="card w-full max-w-sm p-6 shadow-pop animate-fade-in lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="hidden lg:block">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
              <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
            </div>

            <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 lg:mt-6">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                  mode === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Password
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("passkey")}
                className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                  mode === "passkey" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Fingerprint className="h-3.5 w-3.5" /> Passkey
                </span>
              </button>
            </div>

            {mode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                  <label className="label" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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

                <button type="submit" disabled={loading} className="btn-primary h-12 w-full text-base">
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
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
                    <Fingerprint className="h-7 w-7 text-brand-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Use your device passkey</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Face ID, fingerprint, Windows Hello or a security key
                  </p>
                </div>

                {error && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>
                )}

                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="btn-primary h-12 w-full text-base"
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

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" /> First-time login
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>
                  <span className="font-semibold">Super Admin:</span> admin@hrmate.com / admin123
                </p>
                <p className="text-slate-400">
                  Change the password after first login, then add your team in Admin → Users.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
