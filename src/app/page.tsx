import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function Home() {
  const user = getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
