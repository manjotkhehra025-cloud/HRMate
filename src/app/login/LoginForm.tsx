"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  Mail,
  Lock,
  ArrowUpRight,
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
    { icon: <MapPin className="h-5 w-5" />, label: "Geofenced GPS punch" },
    { icon: <CalendarDays className="h-5 w-5" />, label: "Leave balances" },
    { icon: <MessageSquare className="h-5 w-5" />, label: "Social wall" },
    { icon: <Bell className="h-5 w-5" />, label: "Push notifications" },
  ];

  return (
    <div className="login-light flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-[#F4F7FB] lg:flex-row lg:overflow-hidden">
      {/* Desktop website only (1024px+) — phone never gets this cramped split */}
      <div className="flow-gradient relative hidden h-full w-[48%] shrink-0 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-white/25 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-8 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-32 left-10 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute right-6 top-20 text-white/[0.16]">
          <Fingerprint className="h-80 w-80" strokeWidth={1.05} />
        </div>
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-[42%] w-[68%] bg-[#081C33]/50"
          style={{ clipPath: "polygon(28% 100%, 100% 22%, 100% 100%)" }}
        />
        <div className="pointer-events-none absolute bottom-8 right-[12%] h-36 w-36 rounded-full bg-[#16B878]/40 blur-2xl" />

        <div className="relative flex items-center gap-2.5">
          <Fingerprint className="h-7 w-7 text-white" strokeWidth={1.75} />
          <span className="text-[1.4rem] font-bold tracking-tight text-white">HRMate</span>
        </div>

        <div className="relative max-w-[26rem] pr-6">
          <h1 className="text-[2.45rem] font-bold leading-[1.15] text-white">
            “One platform for your entire workforce.”
          </h1>
          <div className="mt-12 space-y-5">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-4 text-[15.5px] font-medium text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/18 ring-1 ring-white/30 backdrop-blur-sm">
                  {f.icon}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
        <div className="relative h-4" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:items-center lg:justify-center">
        {/* Phone website — match the approved mobile mockup */}
        <div className="flow-gradient relative overflow-hidden px-6 pb-14 pt-[max(1.4rem,env(safe-area-inset-top))] lg:hidden">
          <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/25 blur-2xl" />
          <div className="pointer-events-none absolute right-16 top-20 h-16 w-16 rounded-full bg-white/20 blur-xl" />
          <div className="pointer-events-none absolute left-10 top-28 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
              <Fingerprint className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="block text-[1.4rem] font-bold tracking-tight text-white">HRMate</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">Smart HRMS</span>
            </div>
          </div>
          <h1 className="relative mt-9 text-[2.15rem] font-bold leading-[1.15] text-white">Welcome back</h1>
          <p className="relative mt-2.5 text-[15px] leading-snug text-white/85">
            Sign in to punch in and get to work.
          </p>
          <svg
            className="pointer-events-none absolute -bottom-px left-0 w-full text-[#F4F7FB]"
            viewBox="0 0 400 48"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path fill="currentColor" d="M0 48C100 8 300 8 400 48H0Z" />
          </svg>
        </div>

        <div className="w-full px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:flex lg:justify-center lg:px-12 lg:py-12">
          <div className="login-card card w-full p-5 lg:max-w-[24.5rem] lg:p-8">
            <div className="mb-6 hidden text-center lg:block">
              <h2 className="text-[1.7rem] font-bold tracking-tight text-ink">Welcome back,</h2>
              <p className="mt-1 text-[13.5px] text-muted">Sign in to your workspace</p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={classNames(
                  "h-12 flex-1 rounded-full text-[14px] font-semibold",
                  mode === "password" ? "login-pill-on" : "login-pill-off"
                )}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode("passkey")}
                className={classNames(
                  "h-12 flex-1 rounded-full text-[14px] font-semibold",
                  mode === "passkey" ? "login-pill-on" : "login-pill-off"
                )}
              >
                Passkey
              </button>
            </div>

            {mode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="mt-5 space-y-3.5">
                <div>
                  <label className="label hidden lg:block" htmlFor="email">
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
                      className="input h-12 pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="label hidden lg:block" htmlFor="password">
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
                      className="input h-12 pl-10"
                    />
                  </div>
                </div>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary h-12 w-full rounded-[12px] text-[15px]"
                >
                  {loading ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      Sign in <ArrowUpRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-[15px] border border-[#DDE6EF] bg-[#F4F7FB] p-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#E7F1FF]">
                    <Fingerprint className="h-7 w-7 text-[#1556B8]" />
                  </div>
                  <p className="text-sm font-semibold text-[#172334]">Use your device passkey</p>
                  <p className="mt-1 text-xs text-[#617083]">Face ID, fingerprint, Windows Hello or a security key</p>
                </div>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-600">{error}</p>}
                <button
                  onClick={handlePasskeyLogin}
                  disabled={loading}
                  className="btn-primary h-12 w-full rounded-[12px] text-[15px]"
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

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#07945D]">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
