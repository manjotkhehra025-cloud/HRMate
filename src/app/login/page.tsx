import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Login — HRMate" };

export default function LoginPage() {
  const user = getSessionUser();
  if (user) redirect("/dashboard");
  return <LoginForm />;
}
