import { getSessionUser } from "@/lib/auth";
import ProfileClient from "./ProfileClient";

export const metadata = { title: "Profile — HRMate" };

export default function ProfilePage() {
  const user = getSessionUser()!;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile & Security</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account details and passkeys.
        </p>
      </div>
      <ProfileClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          designation: user.designation,
          color: user.color,
        }}
      />
    </div>
  );
}
