export interface LatLng {
  lat: number;
  lng: number;
}

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function dmsToDecimal(deg: string, min: string, sec: string, hemi: string): number {
  let v = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  const h = hemi.toUpperCase();
  if (h === "S" || h === "W") v = -v;
  return v;
}

/** Pull lat/lng out of a Google Maps URL, OSM URL, DMS, or "lat, lng" paste. */
export function parseCoordsFromText(raw: string): LatLng | null {
  const s = String(raw || "").trim();
  if (!s) return null;

  let m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));

  m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));

  m = s.match(/[?&#](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)[,+/](-?\d+(?:\.\d+)?)/i);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));

  m = s.match(/[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/i);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));

  const dmsRe = /(\d{1,3})[°\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)[\"″]?\s*([NSEW])/gi;
  const dms: RegExpExecArray[] = [];
  let dmsMatch: RegExpExecArray | null;
  while ((dmsMatch = dmsRe.exec(s))) dms.push(dmsMatch);
  if (dms.length >= 2) {
    let lat: number | undefined;
    let lng: number | undefined;
    for (const p of dms) {
      const v = dmsToDecimal(p[1], p[2], p[3], p[4]);
      const h = p[4].toUpperCase();
      if (h === "N" || h === "S") lat = v;
      else lng = v;
    }
    if (lat !== undefined && lng !== undefined) return valid(lat, lng);
  }

  m = s.match(/(-?\d{1,3}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));

  return null;
}

export async function expandMapsShortUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "HRMate/1.0 (attendance geofence)" },
    });
    return res.url || null;
  } catch {
    return null;
  }
}
