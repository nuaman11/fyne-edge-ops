"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTicket, saveTicket, setTicketStatus } from "@/app/actions/tickets";
import { PRIORITIES, TICKET_STATUSES, label, type TicketStatus } from "@/lib/constants";
import { fmtDate, ticketCode, todayISO } from "@/lib/format";
import type { Me, TicketRow, UserLite } from "@/lib/types";
import { Avatar, PageHead, Pill } from "@/components/ui";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

type ClientLite = { id: string; name: string; stage: string };

export function TicketsView({ me, tickets, users, clients, initial }: {
  me: Me; tickets: TicketRow[]; users: UserLite[]; clients: ClientLite[];
  initial: { newTicket?: boolean; openId?: string; mine?: boolean; clientId?: string; due?: string };
}) {
  const router = useRouter();
  const [rows, setRows] = useState(tickets);
  useEffect(() => setRows(tickets), [tickets]);
  const [view, setView] = useState<"board" | "list">(initial.clientId ? "list" : "board");
  const [f, setF] = useState({ assignee: initial.mine ? me.id : "", client: initial.clientId ?? "", prio: "" });
  const [editing, setEditing] = useState<Partial<TicketRow> | null>(
    initial.newTicket ? { dueDate: initial.due ?? null } : initial.openId ? tickets.find((t) => t.id === initial.openId) ?? null : null,
  );
  const [, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const today = todayISO();

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const list = rows.filter((t) => (!f.assignee || t.assigneeId === f.assignee) && (!f.client || t.clientId === f.client) && (!f.prio || t.priority === f.prio));
  const late = (t: TicketRow) => !!t.dueDate && t.status !== "DONE" && t.dueDate < today;

  function closeModal() {
    setEditing(null);
    if (initial.newTicket || initial.openId) router.replace("/tickets");
  }

  function move(id: string, status: TicketStatus) {
    const prev = rows;
    setRows((r) => r.map((t) => (t.id === id ? { ...t, status } : t)));
    start(async () => {
      const res = await setTicketStatus(id, status);
      if (!res.ok) { setRows(prev); toast(res.error); }
    });
  }

  const fields: Field[] = [
    { name: "title", label: "Title", type: "text", full: true, required: true },
    { name: "description", label: "Description", type: "textarea", full: true },
    { name: "clientId", label: "Client", type: "select", options: [["", "Internal (no client)"], ...clients.filter((c) => c.stage !== "CLOSED" || c.id === editing?.clientId).map((c) => [c.id, c.name] as const)] },
    { name: "assigneeId", label: "Assign to", type: "select", options: [["", "Unassigned"], ...users.filter((u) => u.active || u.id === editing?.assigneeId).map((u) => [u.id, `${u.name} · ${u.department}`] as const)] },
    { name: "priority", label: "Priority", type: "select", options: PRIORITIES },
    { name: "status", label: "Status", type: "select", options: TICKET_STATUSES },
    { name: "dueDate", label: "Due date", type: "date" },
  ];

  const card = (t: TicketRow) => (
    <div key={t.id} className="card" draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => setEditing(t)}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setEditing(t); }}>
      <span className={`prio p-${t.priority.toLowerCase()}`} />
      <div className="meta"><span className="code">{ticketCode(t.number)}</span>{t.dueDate ? <span className={late(t) ? "late" : ""}>{fmtDate(t.dueDate)}</span> : null}</div>
      <div className="t">{t.title}</div>
      <div className="meta"><span>{t.clientId ? clientById.get(t.clientId)?.name ?? "Client" : "Internal"}</span><Avatar user={t.assigneeId ? userById.get(t.assigneeId) : null} /></div>
    </div>
  );

  return (
    <>
      <PageHead title="Tickets" sub="Create, assign and track work. Drag cards between columns to update status.">
        <div className="seg">
          <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Board</button>
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>+ New ticket</button>
      </PageHead>
      <div className="toolbar">
        <button className={`btn sm ${f.assignee === me.id ? "primary" : ""}`} onClick={() => setF({ ...f, assignee: f.assignee === me.id ? "" : me.id })}>My tickets</button>
        <select aria-label="Filter by assignee" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
          <option value="">All assignees</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select aria-label="Filter by client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}>
          <option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Filter by priority" value={f.prio} onChange={(e) => setF({ ...f, prio: e.target.value })}>
          <option value="">All priorities</option>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {f.assignee || f.client || f.prio ? <button className="btn sm ghost" onClick={() => setF({ assignee: "", client: "", prio: "" })}>Clear filters</button> : null}
      </div>

      {view === "board" ? (
        <div className="board">
          {TICKET_STATUSES.map(([k, l]) => {
            const items = list.filter((t) => t.status === k).sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
            return (
              <div key={k} className={`col ${over === k ? "over" : ""}`}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(k); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); setOver(null); const t = rows.find((x) => x.id === dragId); if (t && t.status !== k) move(t.id, k); setDragId(null); }}>
                <h3>{l}<span>{items.length}</span></h3>
                {items.length ? items.map(card) : <div className="empty" style={{ textAlign: "center" }}>No tickets</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>ID</th><th>Title</th><th>Client</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {list.slice().sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE") || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9")).map((t) => (
                <tr key={t.id} onClick={() => setEditing(t)}>
                  <td className="code">{ticketCode(t.number)}</td>
                  <td>{t.title}</td>
                  <td>{t.clientId ? clientById.get(t.clientId)?.name : "Internal"}</td>
                  <td>{t.assigneeId ? userById.get(t.assigneeId)?.name : <span className="code">Unassigned</span>}</td>
                  <td><Pill tone={t.priority === "URGENT" ? "bad" : t.priority === "HIGH" ? "warn" : undefined}>{label(PRIORITIES, t.priority)}</Pill></td>
                  <td><Pill tone={t.status === "DONE" ? "ok" : t.status === "IN_REVIEW" ? "acc" : undefined}>{label(TICKET_STATUSES, t.status)}</Pill></td>
                  <td className={late(t) ? "late" : ""}>{fmtDate(t.dueDate)}</td>
                </tr>
              ))}
              {!list.length ? <tr><td colSpan={7} className="empty">No tickets match.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <FormModal
          title={editing.id ? `${ticketCode(editing.number!)} · Edit ticket` : "New ticket"}
          fields={fields}
          initial={{ status: "TODO", priority: "MEDIUM", ...editing }}
          onSubmit={(v) => saveTicket(editing.id ?? null, v)}
          onDelete={editing.id && me.role === "ADMIN" ? () => deleteTicket(editing.id!) : undefined}
          onClose={closeModal}
        />
      ) : null}
    </>
  );
}
