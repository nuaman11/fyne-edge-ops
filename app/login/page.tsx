import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyUser } from "@/lib/queries";
import { AuthSide } from "@/components/AuthSide";
import { LoginForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="login">
      <AuthSide />
      <div className="pane"><LoginForm /></div>
    </div>
  );
}
