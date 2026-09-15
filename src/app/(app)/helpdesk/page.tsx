import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import HelpdeskClient from "./HelpdeskClient";

export default function HelpdeskPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  return <HelpdeskClient currentUserId={user.id} role={user.role} userDept={user.department} />;
}
