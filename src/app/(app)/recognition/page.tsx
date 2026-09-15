import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RecognitionClient from "./RecognitionClient";

export default function RecognitionPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  return <RecognitionClient currentUserId={user.id} role={user.role} userDept={user.department} />;
}
