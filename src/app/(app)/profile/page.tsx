import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import ProfileClient from "./ProfileClient";

export const metadata = { title: "Profile — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ProfilePage() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  const perms = getPermissions(user.id);
  const canFull = perms.isSuperAdmin || perms.has("profile.full");

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
      canFull={canFull}
    />
  );
}
