"use client";

import { useState, useEffect } from "react";
import { MapPin, Save, Navigation, Factory } from "lucide-react";
import { Spinner } from "@/components/ui";

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  color: string;
  sort: number;
}

export default function SettingsTab() {
  const [factory, setFactory] = useState({
    name: "",
    lat: "",
    lng: "",
    radius: "",
    address: "",
    workStart: "09:00",
    workEnd: "18:00",
  });
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setFactory({
          name: d.factory.name,
          lat: String(d.factory.lat),
          lng: String(d.factory.lng),
          radius: String(d.factory.radius),
          address: d.factory.address,
          workStart: d.factory.workStart,
          workEnd: d.factory.workEnd,
        });
        setLeaveTypes(d.leaveTypes);
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factory, leaveTypes }),
    });
    setSaving(false);
    setMessage("Settings saved ✓");
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFactory((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Factory / geofence */}
      <div className="card p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
            <Factory className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Factory location & geofence</h2>
            <p className="text-xs text-slate-500">
              Employees must be within this radius to punch in/out.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Factory name</label>
            <input
              className="input"
              value={factory.name}
              onChange={(e) => setFactory({ ...factory, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Latitude</label>
            <input
              className="input"
              value={factory.lat}
              onChange={(e) => setFactory({ ...factory, lat: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              className="input"
              value={factory.lng}
              onChange={(e) => setFactory({ ...factory, lng: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Geofence radius (meters)</label>
            <input
              type="number"
              className="input"
              value={factory.radius}
              onChange={(e) => setFactory({ ...factory, radius: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input
              className="input"
              value={factory.address}
              onChange={(e) => setFactory({ ...factory, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Work start</label>
            <input
              type="time"
              className="input"
              value={factory.workStart}
              onChange={(e) => setFactory({ ...factory, workStart: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Work end</label>
            <input
              type="time"
              className="input"
              value={factory.workEnd}
              onChange={(e) => setFactory({ ...factory, workEnd: e.target.value })}
            />
          </div>
        </div>

        <button onClick={useMyLocation} disabled={locating} className="btn-secondary mt-4 text-xs">
          <Navigation className="h-3.5 w-3.5" />
          {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>

      {/* Leave types */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-800">Leave types</h2>
        <p className="text-xs text-slate-500">Configure leave categories and annual allowances.</p>

        <div className="mt-4 space-y-3">
          {leaveTypes.map((lt, i) => (
            <div key={lt.id} className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                className="input"
                value={lt.name}
                onChange={(e) =>
                  setLeaveTypes((ls) => ls.map((x) => (x.id === lt.id ? { ...x, name: e.target.value } : x)))
                }
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input"
                  value={lt.days_per_year}
                  onChange={(e) =>
                    setLeaveTypes((ls) =>
                      ls.map((x) => (x.id === lt.id ? { ...x, days_per_year: parseInt(e.target.value) || 0 } : x))
                    )
                  }
                />
                <span className="text-xs text-slate-400">days/yr</span>
              </div>
              <input
                type="color"
                value={lt.color}
                onChange={(e) =>
                  setLeaveTypes((ls) => ls.map((x) => (x.id === lt.id ? { ...x, color: e.target.value } : x)))
                }
                className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Spinner className="h-4 w-4" /> : <><Save className="h-4 w-4" /> Save all settings</>}
        </button>
        {message && <span className="text-sm font-medium text-emerald-600">{message}</span>}
      </div>
    </div>
  );
}
