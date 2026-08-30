export const STAFF_CAPS = {
  total: 70,
  yellow_card: 50,
  official: 20,
} as const;

export type StaffType = "official" | "yellow_card";
export type ManagerScope = "engineering" | "operations" | "";

export const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export const MANAGER_SCOPES: { value: "operations" | "engineering"; label: string; hint: string }[] = [
  {
    value: "operations",
    label: "Senior Manager Production",
    hint: "Production, Lab, Store, Quality",
  },
  {
    value: "engineering",
    label: "AGM Engineering",
    hint: "Electrician, Maintenance, Instrument",
  },
];

export const DEPARTMENTS: { name: string; scope: "engineering" | "operations" }[] = [
  { name: "Production", scope: "operations" },
  { name: "Store", scope: "operations" },
  { name: "Lab", scope: "operations" },
  { name: "Production & Quality", scope: "operations" },
  { name: "Maintenance", scope: "engineering" },
  { name: "Instrument", scope: "engineering" },
  { name: "Electrician", scope: "engineering" },
];

export function departmentScope(department: string): "engineering" | "operations" | "" {
  const d = (department || "").trim().toLowerCase();
  const hit = DEPARTMENTS.find((x) => x.name.toLowerCase() === d);
  if (hit) return hit.scope;
  if (/mainten|instrument|electric/.test(d)) return "engineering";
  if (/product|store|lab|quality/.test(d)) return "operations";
  return "";
}

export function staffTypeLabel(t: string) {
  return t === "yellow_card" ? "Yellow card / Third party" : "Official G.D. Foods Staff";
}

export function parseWeeklyOff(v: unknown, fallback = 6) {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return fallback;
}

export function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00+05:30").getDay();
}

export function isWeeklyOff(date: string, weeklyOff: number | null | undefined): boolean {
  return weekdayOf(date) === parseWeeklyOff(weeklyOff, 6);
}

export function weeklyOffLabel(n: number | null | undefined) {
  const v = parseWeeklyOff(n, 6);
  return WEEKDAYS.find((w) => w.value === v)?.label || "Saturday";
}

export function isLeadershipRole(role: string) {
  return role === "manager" || role === "admin" || role === "super_admin";
}
