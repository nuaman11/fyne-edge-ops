import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/AuthForms";
import { PageHead, Pill } from "@/components/ui";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireUser();
  return (
    <>
      <PageHead title="My account" sub={me.email} />
      <section className="panel narrow">
        <h2>Profile</h2>
        <div className="rows">
          <div className="row" style={{ cursor: "default" }}><div className="grow"><div className="s">Name</div><div className="t">{me.name}</div></div></div>
          <div className="row" style={{ cursor: "default" }}><div className="grow"><div className="s">Access</div><Pill tone={me.role === "ADMIN" ? "acc" : undefined}>{me.role === "ADMIN" ? "Admin" : "User"}</Pill></div></div>
          <div className="row" style={{ cursor: "default" }}><div className="grow"><div className="s">Department</div><div className="t">{me.department}{me.isDeptHead ? " (head)" : ""}</div></div></div>
        </div>
        <p className="fine" style={{ marginBottom: 0 }}>To change your name, email or department, ask an admin.</p>
      </section>
      <ChangePasswordForm />
    </>
  );
}
