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
      <div className="hidden lg:block">
        <h1 className="page-title">Social Wall</h1>
        <p className="page-sub">
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
