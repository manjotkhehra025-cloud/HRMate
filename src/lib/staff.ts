export const STAFF_CAPS = {
  total: 70,
  yellow_card: 50,
  official: 20,
} as const;

export type StaffType = "official" | "yellow_card";
export type ManagerScope = "engineering" | "operations" | "";

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
