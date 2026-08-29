import { NextRequest } from "next/server";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { parseCoordsFromText, expandMapsShortUrl } from "@/lib/maps";

export const dynamic = "force-dynamic";

const UA = "HRMate/1.0 (attendance geofence; https://hrmate)";

function guard() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "admin.settings")) {
    return error("You don't have permission to update the attendance area", 403);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = guard();
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return error("lat and lng are required");
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return json({ address: "" });
    const data = await res.json();
    return json({ address: data.display_name || "" });
  } catch {
    return json({ address: "" });
  }
}

export async function POST(req: NextRequest) {
  const denied = guard();
  if (denied) return denied;
  const body = await req.json();
  const raw = String(body.url || body.text || "").trim();
  if (!raw) return error("Paste a Google Maps or OpenStreetMap link");

  let coords = parseCoordsFromText(raw);
  if (!coords && /goo\.gl|maps\.app\.goo\.gl|maps\.google/i.test(raw)) {
    const expanded = await expandMapsShortUrl(raw);
    if (expanded) coords = parseCoordsFromText(expanded);
  }
  if (!coords) return error("Could not read coordinates from that link. Paste lat, lng or a Maps URL with @lat,lng.");
  return json({ ok: true, ...coords });
}
