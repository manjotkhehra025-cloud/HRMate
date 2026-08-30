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
    { icon: MapPin, label: "GPS punch in & out" },
    { icon: CalendarDays, label: "Leaves & balances" },
    { icon: MessageSquare, label: "Team social wall" },
    { icon: Bell, label: "Push notifications" },
  ];

  return (
    <div className="login-light flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-[#F4F7FB] lg:flex-row lg:overflow-hidden">
      {/* Desktop left — simple gradient, no clip-path, no watermark */}
      <aside className="flow-gradient relative hidden h-full w-[46%] shrink-0 flex-col justify-between px-12 py-11 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white">
            <Fingerprint className="h-6 w-6 text-[#1E6FE0]" />
          </span>
          <span className="text-[22px] font-bold tracking-tight">HRMate</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70">Smart HRMS</p>
          <h1 className="mt-3 max-w-sm text-[34px] font-bold leading-[1.2]">
            Attendance, leaves and your team — in one place.
          </h1>
          <ul className="mt-10 space-y-4">
            {features.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-[15px] font-medium">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/20">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-white/55">GD Foods</p>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:items-center lg:justify-center">
        {/* Phone header */}
        <header className="flow-gradient px-5 pb-8 pt-[max(18px,env(safe-area-inset-top))] text-white lg:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white">
              <Fingerprint className="h-7 w-7 text-[#1E6FE0]" />
            </span>
            <div>
              <p className="text-[18px] font-bold leading-none">HRMate</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Smart HRMS</p>
            </div>
          </div>
          <h1 className="mt-6 text-[28px] font-bold leading-tight">Welcome back</h1>
          <p className="mt-1.5 text-[14px] text-white/80">Sign in to punch in and get to work.</p>
        </header>

        <div className="w-full px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:px-10 lg:py-0">
          <div className="login-card mx-auto w-full max-w-[400px] rounded-[18px] bg-white p-5 shadow-[0_7px_24px_rgba(11,37,69,0.14)] lg:p-8">
            <div className="mb-5 hidden lg:block">
              <h2 className="text-[26px] font-bold tracking-tight text-[#172334]">Welcome back</h2>
              <p className="mt-1 text-[14px] text-[#617083]">Sign in to your workspace</p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-full bg-[#EEF3F8] p-1">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={classNames(
                  "h-10 rounded-full text-[13px] font-semibold",
                  mode === "password" ? "bg-white text-[#172334] shadow-sm" : "bg-transparent text-[#617083]"
                )}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode("passkey")}
                className={classNames(
                  "h-10 rounded-full text-[13px] font-semibold",
                  mode === "passkey" ? "bg-white text-[#172334] shadow-sm" : "bg-transparent text-[#617083]"
                )}
              >
                Passkey
              </button>
            </div>

            {mode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="mt-5 space-y-3.5">
                <div>
                  <label className="mb-1.5 hidden text-[12.5px] font-medium text-[#617083] lg:block" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#617083]" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="username"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-12 w-full rounded-full border border-[#C9D5E2] bg-white pl-10 pr-3.5 text-[13.5px] text-[#172334] outline-none focus:border-[#1E6FE0]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 hidden text-[12.5px] font-medium text-[#617083] lg:block" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#617083]" />
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-full border border-[#C9D5E2] bg-white pl-10 pr-3.5 text-[13.5px] text-[#172334] outline-none focus:border-[#1E6FE0]"
                    />
                  </div>
                </div>
                {error && <p className="rounded-[11px] bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1E6FE0] text-[15px] font-semibold text-white disabled:opacity-50"
                >
                  {loading ? <Spinner className="h-4 w-4" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-[15px] border border-[#DDE6EF] bg-[#F4F7FB] p-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#E7F1FF]">
                    <Fingerprint className="h-7 w-7 text-[#1556B8]" />
                  </div>
                  <p className="text-sm font-semibold text-[#172334]">Use your device passkey</p>
                  <p className="mt-1 text-xs text-[#617083]">Face ID, fingerprint or Windows Hello</p>
                </div>
                {error && <p className="rounded-[11px] bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>}
                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1E6FE0] text-[15px] font-semibold text-white disabled:opacity-50"
                >
                  {loading ? <Spinner className="h-4 w-4" /> : <>Continue with passkey <Fingerprint className="h-4 w-4" /></>}
                </button>
              </div>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#07945D]">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
