"use client";

import { useState, useTransition } from "react";
import { decideHiring, deleteHiring, saveHiring, undoHiringDecision } from "@/app/actions/hiring";
import { DEPARTMENTS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { canApproveDept, hiringStatus, type HiringRow, type Me, type UserLite } from "@/lib/types";
import { EmptyState, PageHead, Pill } from "@/components/ui";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

const TABS = [["pending", "Awaiting approval"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export function HiringView({ me, hiring, users, initialTab }: { me: Me; hiring: HiringRow[]; users: UserLite[]; initialTab?: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>(TABS.find(([k]) => k === initialTab)?.[0] ?? "pending");
  const [editing, setEditing] = useState<Partial<HiringRow> | null>(null);
  const [pending, start] = useTransition();
  const isAdmin = me.role === "ADMIN";
  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "Former user" : "");
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) toast(r.error || "Couldn’t save."); });

  const list = hiring.filter((h) => hiringStatus(h) === tab);
  const heads = (d: string) => users.filter((u) => u.active && u.isDeptHead && u.department === d).map((u) => u.name);
  const fields: Field[] = [
    { name: "candidate", label: "Candidate name", type: "text", required: true },
    { name: "position", label: "Role", type: "text", required: true },
    { name: "department", label: "Hiring department", type: "select", options: DEPARTMENTS.map((d) => [d, d] as const) },
    { name: "startDate", label: "Proposed start date", type: "date" },
    { name: "requiredDepartments", label: "Departments that must approve", type: "multi", full: true, required: true, options: DEPARTMENTS.map((d) => [d, d] as const),
      help: "Each department’s head (or an admin) signs off. Mark department heads on the Users page." },
    { name: "notes", label: "Notes", type: "textarea", full: true },
  ];

  return (
    <>
      <PageHead title="Hiring approvals" sub="Each department head signs off. A hire is final once every required department approves.">
        {isAdmin ? <button className="btn primary" onClick={() => setEditing({ department: "Engineering", requiredDepartments: ["Engineering", "HR", "Finance", "Management"] })}>+ New hiring request</button> : null}
      </PageHead>
      <div className="tabs">
        {TABS.map(([k, l]) => <button key={k} className={k === tab ? "on" : ""} onClick={() => setTab(k)}>{l}<span className="n">{hiring.filter((h) => hiringStatus(h) === k).length}</span></button>)}
      </div>
      {!list.length ? (
        tab === "pending" ? (
          <EmptyState title="No hiring requests waiting" actions={isAdmin ? <button className="btn primary" onClick={() => setEditing({ department: "Engineering", requiredDepartments: ["Engineering", "HR", "Finance", "Management"] })}>+ Add your first hiring request</button> : undefined}>
            {isAdmin ? "Raise a request for a new hire and pick which departments must sign off. Each head approves it here." : "When an admin raises a hiring request, it appears here for department sign-off."}
          </EmptyState>
        ) : tab === "approved" ? <EmptyState title="No approved hires yet">A hire lands here once every required department has approved it.</EmptyState>
          : <EmptyState title="No rejected requests">If any department rejects a hire, it moves here with who decided and when.</EmptyState>
      ) : (
        <div className={`cards ${pending ? "busy" : ""}`}>
          {list.map((h) => {
            const st = hiringStatus(h);
            const byDept = new Map(h.approvals.map((a) => [a.department, a]));
            return (
              <article className="rec" key={h.id}>
                <div className="hd">
                  <div><h3>{h.candidate}</h3><div className="sub">{h.position} · {h.department}{h.startDate ? ` · start ${fmtDate(h.startDate, true)}` : ""}</div></div>
                  <div style={{ textAlign: "right" }}>
                    <Pill tone={st === "approved" ? "ok" : st === "rejected" ? "bad" : "warn"}>{st === "approved" ? "Final: approved" : st === "rejected" ? "Rejected" : "Pending"}</Pill><br />
                    <button className="btn sm ghost" onClick={() => setEditing(h)}>{isAdmin ? "Edit" : "Details"}</button>
                  </div>
                </div>
                {h.notes ? <div className="sub">{h.notes}</div> : null}
                <div>
                  <div className="lbl">Department sign-off</div>
                  <div className="appr">
                    {h.requiredDepartments.map((d) => {
                      const a = byDept.get(d);
                      return (
                        <div className="a" key={d}>
                          <b>{d}</b>
                          <div className="act">
                            {a ? (
                              <>
                                <Pill tone={a.decision === "APPROVED" ? "ok" : "bad"}>{a.decision === "APPROVED" ? "Approved" : "Rejected"} · {nameOf(a.decidedById)} · {fmtDate(a.decidedAt.slice(0, 10))}</Pill>
                                {isAdmin || a.decidedById === me.id ? <button className="btn sm ghost" onClick={() => act(() => undoHiringDecision(h.id, d))}>Undo</button> : null}
                              </>
                            ) : canApproveDept(me, d) ? (
                              <>
                                <button className="btn sm okb" onClick={() => act(() => decideHiring(h.id, d, "APPROVED"))}>Approve</button>
                                <button className="btn sm danger" onClick={() => act(() => decideHiring(h.id, d, "REJECTED"))}>Reject</button>
                              </>
                            ) : <Pill title={heads(d).length ? `Head: ${heads(d).join(", ")}` : "No department head set"}>Waiting</Pill>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editing ? (
        <FormModal title={editing.id ? (isAdmin ? "Edit hiring request" : editing.candidate!) : "New hiring request"} fields={fields} initial={editing} readOnly={!isAdmin}
          onSubmit={(v) => saveHiring(editing.id ?? null, v)} onDelete={editing.id && isAdmin ? () => deleteHiring(editing.id!) : undefined} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
