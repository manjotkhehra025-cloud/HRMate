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

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Fingerprint className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">
            HR<span className="text-brand-200">Mate</span>
          </span>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-4xl font-bold leading-tight text-white">
            One platform for your entire workforce.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            GPS attendance, leave management, a social wall and approval workflows — all in one
            beautiful place.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: <MapPin className="h-4 w-4" />, label: "Geofenced GPS punch in & out" },
              { icon: <CalendarDays className="h-4 w-4" />, label: "Leave balances & applications" },
              { icon: <MessageSquare className="h-4 w-4" />, label: "Social wall for your team" },
              { icon: <Bell className="h-4 w-4" />, label: "Real-time push notifications" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                  {f.icon}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-brand-200">
          © {new Date().getFullYear()} HRMate. Smart HRMS.
        </p>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center bg-white px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              HR<span className="text-brand-600">Mate</span>
            </span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>

          {/* Tabs */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setMode("password")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Password
              </span>
            </button>
            <button
              onClick={() => setMode("passkey")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
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
                <label className="label" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner className="h-4 w-4" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
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
                  Face ID, Touch ID, Windows Hello or a security key
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
              )}

              <button onClick={handlePasskeyLogin} disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner className="h-4 w-4" /> : <>Authenticate with passkey <Fingerprint className="h-4 w-4" /></>}
              </button>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Initial admin login
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p><span className="font-semibold">Super Admin:</span> admin@hrmate.com / admin123</p>
              <p className="text-slate-400">Change the password after first login, then create your team in Admin → Users.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
