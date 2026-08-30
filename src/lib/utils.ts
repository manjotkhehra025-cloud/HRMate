export const IST = "Asia/Kolkata";

export function istParts(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const hour = parseInt(parts.hour, 10) % 24;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    monthKey: `${parts.year}-${parts.month}`,
  };
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

export function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00+05:30");
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IST,
  });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function classNames(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(" ");
}

/** Inclusive working days between two YYYY-MM-DD strings, skipping that person's weekly off. */
export function businessDays(start: string, end: string, weeklyOff = 6): number {
  let count = 0;
  let cur = start;
  const off = weeklyOff >= 0 && weeklyOff <= 6 ? weeklyOff : 6;
  while (cur <= end) {
    const weekday = new Date(cur + "T12:00:00+05:30").getDay();
    if (weekday !== off) count++;
    const [y, m, d] = cur.split("-").map(Number);
    cur = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }
  return count;
}
