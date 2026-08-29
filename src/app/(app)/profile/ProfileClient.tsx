"use client";

import { useState, useEffect } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Plus, Trash2, ShieldCheck, Smartphone, KeyRound } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: number;
}

export default function ProfileClient({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    designation: string;
    color: string;
  };
}) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/passkeys");
    const data = await res.json();
    setPasskeys(data.passkeys);
  }

  useEffect(() => {
    load();
  }, []);

  async function registerPasskey() {
    setRegistering(true);
    setError("");
    setMessage("");
    try {
      const optsRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start registration");
      const options = await optsRes.json();

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json();
        throw new Error(d.error || "Registration failed");
      }
      setMessage("Passkey registered successfully ✓");
      load();
    } catch (e: any) {
      setError(e?.message || "Passkey registration failed");
    } finally {
      setRegistering(false);
    }
  }

  async function removePasskey(id: string) {
    await fetch("/api/passkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Account card */}
      <div className="card p-6 lg:col-span-1">
        <div className="flex flex-col items-center text-center">
          <Avatar name={user.name} color={user.color} size={72} />
          <h2 className="mt-3 text-lg font-bold text-slate-900">{user.name}</h2>
          <p className="text-sm text-slate-500">{user.email}</p>
          <span className="mt-2 badge bg-brand-50 text-brand-700 ring-1 ring-brand-600/20 capitalize">
            {user.role.replace("_", " ")}
          </span>
        </div>
        <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Department</span>
            <span className="font-medium text-slate-700">{user.department || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Designation</span>
            <span className="font-medium text-slate-700">{user.designation || "—"}</span>
          </div>
        </div>
      </div>

      {/* Passkeys */}
      <div className="card p-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Fingerprint className="h-4 w-4 text-brand-500" /> Passkeys
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Sign in securely with Face ID, Touch ID, Windows Hello or a security key.
            </p>
          </div>
          <button onClick={registerPasskey} disabled={registering} className="btn-primary px-3 py-2 text-xs">
            {registering ? <Spinner className="h-4 w-4" /> : <><Plus className="h-3.5 w-3.5" /> Add passkey</>}
          </button>
        </div>

        {message && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}

        <div className="mt-4 space-y-3">
          {passkeys.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <KeyRound className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">No passkeys registered yet.</p>
              <p className="max-w-xs text-xs text-slate-400">
                Add a passkey to enable passwordless sign-in on this device.
              </p>
            </div>
          ) : (
            passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <Smartphone className="h-5 w-5 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{pk.device_name}</p>
                  <p className="text-xs text-slate-400">Added {timeAgo(pk.created_at)}</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <button
                  onClick={() => removePasskey(pk.id)}
                  className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
