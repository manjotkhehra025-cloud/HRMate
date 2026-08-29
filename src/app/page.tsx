import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default function Home() {
  const user = getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
