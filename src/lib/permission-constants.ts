export type Permission =
  | "attendance.view"
  | "attendance.punch"
  | "attendance.manual"
  | "attendance.team"
  | "leaves.view"
  | "leaves.apply"
  | "leaves.approve"
  | "leaves.team"
  | "wall.view"
  | "wall.post"
  | "wall.moderate"
  | "approvals.view"
  | "approvals.manage"
  | "admin.view"
  | "admin.users"
  | "admin.permissions"
  | "admin.settings"
  | "reports.view";

export const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "attendance.view", label: "View own attendance", group: "Attendance" },
  { key: "attendance.punch", label: "GPS punch in / out", group: "Attendance" },
  { key: "attendance.manual", label: "Request manual punch", group: "Attendance" },
  { key: "attendance.team", label: "View team attendance", group: "Attendance" },
  { key: "leaves.view", label: "View own leaves", group: "Leaves" },
  { key: "leaves.apply", label: "Apply for leave", group: "Leaves" },
  { key: "leaves.approve", label: "Approve / reject leaves", group: "Leaves" },
  { key: "leaves.team", label: "View team leaves", group: "Leaves" },
  { key: "wall.view", label: "View social wall", group: "Social Wall" },
  { key: "wall.post", label: "Post on wall", group: "Social Wall" },
  { key: "wall.moderate", label: "Moderate / delete posts", group: "Social Wall" },
  { key: "approvals.view", label: "View approval queue", group: "Approvals" },
  { key: "approvals.manage", label: "Approve / reject requests", group: "Approvals" },
  { key: "admin.view", label: "Access admin panel", group: "Admin" },
  { key: "admin.users", label: "Manage users", group: "Admin" },
  { key: "admin.permissions", label: "Manage permissions", group: "Admin" },
  { key: "admin.settings", label: "Manage settings & geofence", group: "Admin" },
  { key: "reports.view", label: "View reports", group: "Reports" },
];

export const PERMISSION_GROUPS = ["Attendance", "Leaves", "Social Wall", "Approvals", "Admin", "Reports"];

export const ROLES = ["super_admin", "admin", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

const ROLE_DEFAULTS: Record<Role, (Permission | "*")[]> = {
  super_admin: ["*"],
  admin: [
    "attendance.view", "attendance.punch", "attendance.manual", "attendance.team",
    "leaves.view", "leaves.apply", "leaves.approve", "leaves.team",
    "wall.view", "wall.post", "wall.moderate",
    "approvals.view", "approvals.manage",
    "admin.view", "admin.users", "admin.settings",
    "reports.view",
  ],
  manager: [
    "attendance.view", "attendance.punch", "attendance.manual", "attendance.team",
    "leaves.view", "leaves.apply", "leaves.approve", "leaves.team",
    "wall.view", "wall.post",
    "approvals.view", "approvals.manage",
    "reports.view",
  ],
  employee: [
    "attendance.view", "attendance.punch", "attendance.manual",
    "leaves.view", "leaves.apply",
    "wall.view", "wall.post",
  ],
};

export function roleDefaults(role: string): (Permission | "*")[] {
  return ROLE_DEFAULTS[role as Role] || [];
}
