import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/queries";
import { AuthSide } from "@/components/AuthSide";
import { SetupForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up" };

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <div className="login">
      <AuthSide />
      <div className="pane"><SetupForm /></div>
    </div>
  );
}
