import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RosterClient from "./RosterClient";

export default function RosterPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  return <RosterClient currentUserId={user.id} role={user.role} userDept={user.department} />;
}
