import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import WallClient from "./WallClient";

export const metadata = { title: "Social Wall — HRMate" };

export default function WallPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Social Wall</h1>
        <p className="mt-1 text-sm text-slate-500">
          Announcements, shout-outs and team updates.
        </p>
      </div>
      <WallClient
        canPost={has("wall.post")}
        canModerate={has("wall.moderate")}
        userId={user.id}
      />
    </div>
  );
}
