import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import WallClient from "./WallClient";

export const metadata = { title: "Social Wall — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function WallPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  return (
    <WallClient
      canPost={has("wall.post")}
      canModerate={has("wall.moderate")}
      userId={user.id}
      me={{ name: user.name, color: user.color, avatar: user.avatar }}
    />
  );
}
