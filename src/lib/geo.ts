import db from "./db";

export interface Coords {
  lat: number;
  lng: number;
}

export interface FactoryConfig {
  name: string;
  lat: number;
  lng: number;
  radius: number; // meters
  address: string;
  workStart: string;
  workEnd: string;
}

export function getFactoryConfig(): FactoryConfig {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'factory_%'").all() as {
    key: string;
    value: string;
  }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    name: map.factory_name || "Factory",
    lat: parseFloat(map.factory_lat || "0"),
    lng: parseFloat(map.factory_lng || "0"),
    radius: parseFloat(map.factory_radius || "200"),
    address: map.factory_address || "",
    workStart: map.work_start || "09:00",
    workEnd: map.work_end || "18:00",
  };
}

export function setFactoryConfig(cfg: Partial<FactoryConfig>) {
  const set = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  if (cfg.name !== undefined) set.run("factory_name", cfg.name);
  if (cfg.lat !== undefined) set.run("factory_lat", String(cfg.lat));
  if (cfg.lng !== undefined) set.run("factory_lng", String(cfg.lng));
  if (cfg.radius !== undefined) set.run("factory_radius", String(cfg.radius));
  if (cfg.address !== undefined) set.run("factory_address", cfg.address);
  if (cfg.workStart !== undefined) set.run("work_start", cfg.workStart);
  if (cfg.workEnd !== undefined) set.run("work_end", cfg.workEnd);
}

export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isWithinGeofence(lat: number, lng: number): { within: boolean; distance: number } {
  const cfg = getFactoryConfig();
  const distance = haversineMeters({ lat: cfg.lat, lng: cfg.lng }, { lat, lng });
  return { within: distance <= cfg.radius, distance: Math.round(distance) };
}
