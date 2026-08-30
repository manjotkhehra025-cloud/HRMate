"use client";

export default function GeofenceMap({
  lat,
  lng,
  radius,
  embedded = false,
}: {
  lat: number;
  lng: number;
  radius: number;
  embedded?: boolean;
  onChange?: (next: { lat: number; lng: number }) => void;
}) {
  const safeLat = Number.isFinite(lat) && Math.abs(lat) > 0.01 ? lat : 31.634;
  const safeLng = Number.isFinite(lng) && Math.abs(lng) > 0.01 ? lng : 74.8723;
  const maps = `https://www.google.com/maps?q=${safeLat},${safeLng}`;
  const embed = `https://maps.google.com/maps?q=${safeLat},${safeLng}&z=17&hl=en&output=embed`;

  const frame = (
    <div className={embedded ? "relative h-[200px] w-full sm:h-[240px] lg:h-[260px]" : "relative h-[220px] w-full sm:h-[280px]"}>
      <iframe
        key={`${safeLat.toFixed(5)},${safeLng.toFixed(5)}`}
        title="Attendance area"
        src={embed}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {embedded && (
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-[#1E6FE0] shadow-sm"
        >
          Open in Google Maps
        </a>
      )}
    </div>
  );

  if (embedded) return frame;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-[#F4F7FB]">
      {frame}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
        <p className="min-w-0 break-all text-[11px] text-muted">
          {safeLat.toFixed(5)}, {safeLng.toFixed(5)} · {radius}m circle
        </p>
        <a href={maps} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-semibold text-brand-600">
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
