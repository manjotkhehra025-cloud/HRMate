import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import DocumentsClient from "./DocumentsClient";

export default function DocumentsPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  return <DocumentsClient currentUserId={user.id} role={user.role} userDept={user.department} />;
}
