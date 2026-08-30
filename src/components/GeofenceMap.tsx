"use client";

function lon2tile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

export default function GeofenceMap({
  lat,
  lng,
  radius,
}: {
  lat: number;
  lng: number;
  radius: number;
  onChange?: (next: { lat: number; lng: number }) => void;
}) {
  const safeLat = Number.isFinite(lat) && Math.abs(lat) > 0.01 ? lat : 31.634;
  const safeLng = Number.isFinite(lng) && Math.abs(lng) > 0.01 ? lng : 74.8723;
  const zoom = 16;
  const x = lon2tile(safeLng, zoom);
  const y = lat2tile(safeLat, zoom);
  const maps = `https://www.google.com/maps?q=${safeLat},${safeLng}`;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-[#E8F0E8]">
      <div className="relative h-[160px] w-full sm:h-[220px]">
        <img
          src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
          alt="Attendance area"
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-full rounded-full border-2 border-white bg-brand-500 shadow" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500/70 bg-brand-500/15" />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-[11px] text-muted">
          {safeLat.toFixed(5)}, {safeLng.toFixed(5)} · {radius}m · © OSM
        </p>
        <a href={maps} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-brand-600">
          Open in Maps
        </a>
      </div>
    </div>
  );
}
