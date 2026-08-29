import { initials } from "@/lib/utils";

export default function Avatar({
  name,
  color = "#6366f1",
  size = 40,
  className = "",
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
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
