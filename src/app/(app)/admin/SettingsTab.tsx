"use client";

import { useState, useEffect } from "react";
import { Save, Navigation, Factory } from "lucide-react";
import { Spinner } from "@/components/ui";
import GeofenceMap from "@/components/GeofenceMap";
import { parseCoordsFromText } from "@/lib/maps";

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
  const [mapsLink, setMapsLink] = useState("");

  function applyFactory(d: any) {
    setFactory({
      name: d.factory.name,
      lat: String(d.factory.lat),
      lng: String(d.factory.lng),
      radius: String(d.factory.radius),
      address: d.factory.address || "",
      workStart: d.factory.workStart,
      workEnd: d.factory.workEnd,
    });
    if (d.leaveTypes) setLeaveTypes(d.leaveTypes);
  }

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        applyFactory(d);
        setLoading(false);
      })
      .catch(() => {
        setMessage("Could not load settings");
        setLoading(false);
      });
  }, []);

  async function save(nextFactory?: typeof factory) {
    const payload = nextFactory ?? factory;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factory: payload, leaveTypes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Save failed");
        return;
      }
      if (data.factory) applyFactory({ factory: data.factory, leaveTypes });
      setMessage("Settings saved ✓");
    } catch {
      setMessage("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  }

  async function applyMapsLink() {
    const local = parseCoordsFromText(mapsLink);
    if (local) {
      const next = { ...factory, lat: String(local.lat), lng: String(local.lng) };
      setFactory(next);
      setMessage("Pin moved to that location");
      return;
    }
    const res = await fetch("/api/admin/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: mapsLink }),
    });
    const d = await res.json();
    if (!res.ok) {
      setMessage(d.error || "Could not read that link");
      return;
    }
    setFactory({ ...factory, lat: String(d.lat), lng: String(d.lng) });
    setMessage("Pin moved to that location");
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage("GPS not available on this device");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          ...factory,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        };
        setFactory(next);
        setLocating(false);
        save(next);
      },
      () => {
        setLocating(false);
        setMessage("Location permission denied. Enable GPS and try again.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
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

        <div className="mt-5">
          <GeofenceMap
            lat={parseFloat(factory.lat) || 0}
            lng={parseFloat(factory.lng) || 0}
            radius={parseFloat(factory.radius) || 100}
            onChange={({ lat, lng }) =>
              setFactory((f) => ({ ...f, lat: String(lat), lng: String(lng) }))
            }
          />
          <p className="mt-2 text-xs text-muted">
            Pan the Google map. To change the pin, paste a Google Maps link below.
          </p>
        </div>

        <div className="mt-4">
          <label className="label">Paste Google Maps or OSM link</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="https://maps.google.com/… or 31.63, 74.87"
              value={mapsLink}
              onChange={(e) => setMapsLink(e.target.value)}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={applyMapsLink}>
              Go
            </button>
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

        <button onClick={useMyLocation} disabled={locating || saving} className="btn-secondary mt-4 text-xs">
          <Navigation className="h-3.5 w-3.5" />
          {locating ? "Locating…" : "Use my current location (saves immediately)"}
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
        <button onClick={() => save()} disabled={saving} className="btn-primary">
          {saving ? <Spinner className="h-4 w-4" /> : <><Save className="h-4 w-4" /> Save all settings</>}
        </button>
        {message && (
          <span
            className={`text-sm font-medium ${
              message.includes("fail") || message.includes("denied") || message.includes("not")
                ? "text-rose-600"
                : "text-emerald-600"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
