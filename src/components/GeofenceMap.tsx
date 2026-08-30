"use client";

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
  const maps = `https://www.google.com/maps?q=${safeLat},${safeLng}`;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-[#F4F7FB]">
      <div className="relative flex h-[140px] items-center justify-center sm:h-[180px]">
        <div className="h-28 w-28 rounded-full border-2 border-brand-500/50 bg-brand-500/10" />
        <div className="absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500 shadow" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <p className="text-[11px] text-muted">
          {safeLat.toFixed(5)}, {safeLng.toFixed(5)} · {radius}m circle
        </p>
        <a href={maps} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-semibold text-brand-600">
          Open in Maps
        </a>
      </div>
    </div>
  );
}
