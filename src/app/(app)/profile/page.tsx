import { getSessionUser } from "@/lib/auth";
import ProfileClient from "./ProfileClient";

export const metadata = { title: "My profile — HRMate" };

export default function ProfilePage() {
  const user = getSessionUser()!;
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="page-title">My profile</h1>
        <p className="page-sub">Photo, name, phone, password and passkeys.</p>
      </div>
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
      />
    </div>
  );
}
