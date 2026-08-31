import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import ProfileClient from "./ProfileClient";

export const metadata = { title: "My profile — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ProfilePage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  return (
    <ProfileClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        phone: user.phone || "",
        color: user.color,
        avatar: user.avatar || "",
      }}
      canFull={perms.isSuperAdmin || perms.has("profile.full")}
    />
  );
}
