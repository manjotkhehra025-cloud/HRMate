import db from "./db";
import { roleDefaults, type Permission } from "./permission-constants";

export * from "./permission-constants";

export interface EffectivePermissions {
  has: (p: Permission) => boolean;
  list: Set<Permission>;
  isSuperAdmin: boolean;
}

export function getPermissions(userId: string): EffectivePermissions {
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string } | undefined;
  if (!user) return { has: () => false, list: new Set(), isSuperAdmin: false };

  if (user.role === "super_admin") {
    return { has: () => true, list: new Set(), isSuperAdmin: true };
  }

  const base = new Set<Permission>(
    roleDefaults(user.role).filter((p): p is Permission => p !== "*")
  );
  const overrides = db
    .prepare("SELECT permission, granted FROM user_permissions WHERE user_id = ?")
    .all(userId) as { permission: Permission; granted: number }[];

  for (const o of overrides) {
    if (o.granted) base.add(o.permission);
    else base.delete(o.permission);
  }

  return {
    has: (p) => base.has(p),
    list: base,
    isSuperAdmin: false,
  };
}

export function hasPermission(userId: string, permission: Permission): boolean {
  return getPermissions(userId).has(permission);
}
