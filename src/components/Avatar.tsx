import { initials } from "@/lib/utils";

export default function Avatar({
  name,
  color = "#6366f1",
  size = 40,
  className = "",
  src,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-sm ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/80 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </div>
  );
}

export function avatarSrc(userId?: string, stamp?: string | null) {
  if (!userId || !stamp) return undefined;
  return `/api/avatar/${userId}?v=${stamp}`;
}
