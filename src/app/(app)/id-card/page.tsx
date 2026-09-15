import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import IdCardClient from "./IdCardClient";

export const metadata = { title: "Digital ID Card & Gate Pass — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function IdCardPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");

  return (
    <IdCardClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        color: user.color,
        avatar: user.avatar,
      }}
    />
  );
}
