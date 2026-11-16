"use client";

import { useEffect, useState, useTransition } from "react";
import { resolveClientTickets } from "@/app/actions/clients";
import { TICKET_STATUSES, label } from "@/lib/constants";
import { fmtDate, plural, ticketCode } from "@/lib/format";
import type { UserLite } from "@/lib/types";
import { toast } from "@/components/Toaster";

export type ResolveTicket = { id: string; number: number; title: string; status: string; dueDate: string | null; assigneeId: string | null };
type Choice = { action: "done" | "keep"; assigneeId: string };

/** Before closing a client: decide, per open ticket, to mark it done or keep it open and reassign it. */
export function ResolveTicketsModal({ client, tickets, users, closeAfter, onClose }: {
  client: { id: string; name: string }; tickets: ResolveTicket[]; users: UserLite[]; closeAfter: boolean; onClose: () => void;
}) {
  const [plan, setPlan] = useState<Record<string, Choice>>(() => Object.fromEntries(tickets.map((t) => [t.id, { action: "done", assigneeId: t.assigneeId ?? "" }])));
  const [touched, setTouched] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const people = users.filter((u) => u.active);
  const close = () => (touched ? setAskDiscard(true) : onClose());

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); if (touched) setAskDiscard(true); else onClose(); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [touched, onClose]);

  const set = (id: string, c: Partial<Choice>) => { setTouched(true); setPlan((p) => ({ ...p, [id]: { ...p[id]!, ...c } })); };
  const setAll = (action: Choice["action"]) => { setTouched(true); setPlan((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, action }]))); };

  function apply() {
    setError(null);
    start(async () => {
      const r = await resolveClientTickets(client.id, tickets.map((t) => ({ ticketId: t.id, action: plan[t.id]!.action, assigneeId: plan[t.id]!.assigneeId || null })), closeAfter);
      if (!r.ok) { setError(r.error); return; }
      toast(closeAfter ? `${client.name} closed.` : "Tickets updated.");
      onClose();
    });
  }

  return (
    <div className="scrim open" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`modal ${pending ? "busy" : ""}`} role="dialog" aria-modal="true" aria-label="Open tickets">
        <div className="mhead"><h2>{closeAfter ? "Before you close this client" : "Open tickets"}</h2><button type="button" className="x" aria-label="Close" onClick={close}>×</button></div>
        {error ? <div className="err" role="alert">{error}</div> : null}
        <div className="mbody"><div className="mmain">
          <p className="mtext"><b>{client.name}</b> still has {plural(tickets.length, "open ticket")}. Choose what happens to each one{closeAfter ? " before the client is closed" : ""}.</p>
          <div className="toolbar"><button type="button" className="btn sm" onClick={() => setAll("done")}>Mark all done</button><button type="button" className="btn sm" onClick={() => setAll("keep")}>Keep all open</button></div>
          <div className="rtlist">
            {tickets.map((t) => {
              const c = plan[t.id]!;
              return (
                <div className="rt" key={t.id}>
                  <div><div className="t"><span className="code">{ticketCode(t.number)}</span> {t.title}</div><div className="s">{label(TICKET_STATUSES, t.status)}{t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ""}</div></div>
                  <select aria-label={`What to do with ${ticketCode(t.number)}`} value={c.action} onChange={(e) => set(t.id, { action: e.target.value as Choice["action"] })}>
                    <option value="done">Mark done</option><option value="keep">Keep open</option>
                  </select>
                  <select aria-label={`Assign ${ticketCode(t.number)} to`} value={c.assigneeId} disabled={c.action === "done"} onChange={(e) => set(t.id, { assigneeId: e.target.value })}>
                    <option value="">Unassigned</option>{people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <p className="fine" style={{ margin: 0 }}>Tickets you keep open stay on the board under {client.name}, assigned to whoever you pick. Every change is recorded in the ticket’s activity.</p>
        </div></div>
        {askDiscard ? (
          <div className="mfoot"><span className="discard">Discard your choices?</span><div className="r"><button className="btn" type="button" autoFocus onClick={() => setAskDiscard(false)}>Keep editing</button><button className="btn danger-solid" type="button" onClick={onClose}>Discard</button></div></div>
        ) : (
          <div className="mfoot"><div className="r"><button className="btn" type="button" onClick={close}>Cancel</button><button className="btn primary" type="button" onClick={apply}>{pending ? "Saving…" : closeAfter ? "Apply and close client" : "Apply"}</button></div></div>
        )}
      </div>
    </div>
  );
}
