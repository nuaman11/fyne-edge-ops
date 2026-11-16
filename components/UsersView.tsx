"use client";

import { useState } from "react";
import { createUser, deleteUser, resetUserPassword, updateUser } from "@/app/actions/users";
import { DEPARTMENTS } from "@/lib/constants";
import type { UserAdminRow } from "@/lib/types";
import { Avatar, PageHead, Pill } from "@/components/ui";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

type Row = UserAdminRow & { locked: boolean };

function suggestPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}
function ago(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function UsersView({ meId, users, openId }: { meId: string; users: Row[]; openId?: string }) {
  const [mode, setMode] = useState<{ kind: "new" } | { kind: "edit"; u: Row } | { kind: "reset"; u: Row } | null>(() => {
    const u = openId ? users.find((x) => x.id === openId) : undefined;
    return u ? { kind: "edit", u } : null;
  });
  const [q, setQ] = useState("");

  const profileFields: Field[] = [
    { name: "name", label: "Full name", type: "text", required: true },
    { name: "email", label: "Email (used to sign in)", type: "email", required: true },
    { name: "role", label: "Access level", type: "select", options: [["USER", "User (limited access)"], ["ADMIN", "Admin (full access)"]] },
    { name: "department", label: "Department", type: "select", options: DEPARTMENTS.map((d) => [d, d] as const) },
    { name: "jobTitle", label: "Job title", type: "text", full: true },
    { name: "isDeptHead", label: "Department head: can approve hires for their department", type: "checkbox" },
  ];

  const list = users.filter((u) => !q || (u.name + " " + u.email + " " + u.department).toLowerCase().includes(q.toLowerCase()));
  const admins = users.filter((u) => u.role === "ADMIN" && u.active).length;

  return (
    <>
      <PageHead title="Users" sub={`${users.length} account${users.length === 1 ? "" : "s"} · ${admins} active admin${admins === 1 ? "" : "s"}`}>
        <input type="search" placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <button className="btn primary" onClick={() => setMode({ kind: "new" })}>+ Add user</button>
      </PageHead>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Department</th><th>Last sign-in</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} onClick={() => setMode({ kind: "edit", u })}>
                <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Avatar user={u} />{u.name}{u.id === meId ? <span className="code">(you)</span> : null}</span></td>
                <td>{u.email}</td>
                <td><Pill tone={u.role === "ADMIN" ? "acc" : undefined}>{u.role === "ADMIN" ? "Admin" : "User"}</Pill></td>
                <td>{u.department}{u.isDeptHead ? <> <Pill tone="acc">Head</Pill></> : null}{u.jobTitle ? <div className="fine">{u.jobTitle}</div> : null}</td>
                <td className="fine">{ago(u.lastLoginAt)}</td>
                <td>{!u.active ? <Pill tone="bad">Disabled</Pill> : u.locked ? <Pill tone="warn">Locked</Pill> : <Pill tone="ok">Active</Pill>}</td>
              </tr>
            ))}
            {!list.length ? <tr><td colSpan={6} className="empty">No users match.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <section className="panel">
        <h2>What each access level can do</h2>
        <div className="grid2" style={{ gap: 18 }}>
          <div><div className="lbl">Admin</div><p className="fine" style={{ margin: 0 }}>Everything: add and manage users and admins, clients, developer assignments, closings, the pipeline and hiring requests, and delete records.</p></div>
          <div><div className="lbl">User</div><p className="fine" style={{ margin: 0 }}>Create and update tickets, tick client checklists, and view clients, the calendar, the pipeline and hiring. Can’t delete or change client, pipeline or user settings. Department heads can also approve hires for their department.</p></div>
        </div>
      </section>

      {mode?.kind === "new" ? (
        <FormModal title="Add user" submitLabel="Create user"
          fields={[...profileFields, { name: "password", label: "Temporary password", type: "text", full: true, required: true, help: "At least 10 characters. Share it privately; they can change it under My account." }]}
          initial={{ role: "USER", department: "Engineering", password: suggestPassword() }}
          onSubmit={async (v) => { const r = await createUser(v); if (r.ok) toast(`${v.name} can now sign in with ${v.email}.`); return r; }}
          onClose={() => setMode(null)} />
      ) : null}
      {mode?.kind === "edit" ? (
        <FormModal title={`Edit ${mode.u.name}`}
          fields={[...profileFields, { name: "active", label: "Active: can sign in", type: "checkbox" }]}
          initial={mode.u}
          onSubmit={(v) => updateUser(mode.u.id, v)}
          onDelete={mode.u.id !== meId ? () => deleteUser(mode.u.id) : undefined}
          deleteLabel="Delete user"
          footerExtra={<button className="btn" type="button" onClick={() => setMode({ kind: "reset", u: mode.u })}>Reset password</button>}
          onClose={() => setMode(null)} />
      ) : null}
      {mode?.kind === "reset" ? (
        <FormModal title={`Reset password · ${mode.u.name}`} submitLabel="Set new password"
          fields={[{ name: "password", label: "New password", type: "text", full: true, required: true, help: "At least 10 characters. They’ll be signed out everywhere and must use this password." }]}
          initial={{ password: suggestPassword() }}
          onSubmit={async (v) => { const r = await resetUserPassword(mode.u.id, String(v.password)); if (r.ok) toast("Password reset."); return r; }}
          onClose={() => setMode(null)} />
      ) : null}
    </>
  );
}
