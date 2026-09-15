import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import KraClient from "./KraClient";

export default function KraPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  return <KraClient currentUserId={user.id} role={user.role} userDept={user.department} />;
}
