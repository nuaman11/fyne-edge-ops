"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTicket, saveTicket, setTicketStatus } from "@/app/actions/tickets";
import { PRIORITIES, TICKET_STATUSES, label, type TicketStatus } from "@/lib/constants";
import { addDays, ticketCode, todayISO } from "@/lib/format";
import type { Me, TicketRow, UserLite } from "@/lib/types";
import { Avatar, DueChip, EmptyState, Icon, PageHead, PrioGlyph } from "@/components/ui";
import { TicketThread } from "@/components/TicketThread";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

type ClientLite = { id: string; name: string; stage: string };
const QUICK = [["", "All"], ["open", "Open"], ["overdue", "Overdue"], ["week", "Due this week"], ["mine", "Assigned to me"], ["created", "Created by me"]] as const;
const QUICK_KEYS = QUICK.map(([k]) => k).filter(Boolean);
type Quick = (typeof QUICK)[number][0];

export function TicketsView({ me, tickets, users, clients, initial }: {
  me: Me; tickets: TicketRow[]; users: UserLite[]; clients: ClientLite[];
  initial: { newTicket?: boolean; openId?: string; mine?: boolean; clientId?: string; due?: string; filter?: string; assigneeId?: string };
}) {
  const router = useRouter();
  const [rows, setRows] = useState(tickets);
  useEffect(() => setRows(tickets), [tickets]);
  const startQuick = (QUICK_KEYS as readonly string[]).includes(initial.filter ?? "") ? (initial.filter as Quick) : initial.mine ? "mine" : "";
  const [view, setView] = useState<"board" | "list">(initial.clientId || startQuick ? "list" : "board");
  useEffect(() => {
    if (initial.clientId || startQuick) return;
    try { const v = localStorage.getItem("fyne-ticket-view"); if (v === "board" || v === "list") setView(v); } catch {}
  }, [initial.clientId, startQuick]);
  const chooseView = (v: "board" | "list") => { setView(v); try { localStorage.setItem("fyne-ticket-view", v); } catch {} };
  const [f, setF] = useState({ assignee: initial.assigneeId ?? "", client: initial.clientId ?? "", prio: "", quick: startQuick as Quick });
  const [editing, setEditing] = useState<Partial<TicketRow> | null>(
    initial.newTicket ? { dueDate: initial.due ?? null } : initial.openId ? tickets.find((t) => t.id === initial.openId) ?? null : null,
  );
  const [, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const today = todayISO();

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const base = rows.filter((t) => (!f.assignee || t.assigneeId === f.assignee) && (!f.client || t.clientId === f.client) && (!f.prio || t.priority === f.prio));
  const quickMatch = (t: TicketRow, q: Quick) => {
    switch (q) {
      case "open": return t.status !== "DONE";
      case "overdue": return !!t.dueDate && t.status !== "DONE" && t.dueDate < today;
      case "week": return !!t.dueDate && t.status !== "DONE" && t.dueDate <= addDays(today, 7);
      case "mine": return t.assigneeId === me.id;
      case "created": return t.createdById === me.id;
      default: return true;
    }
  };
  const list = base.filter((t) => quickMatch(t, f.quick));
  const anyFilter = !!(f.assignee || f.client || f.prio || f.quick);

  function closeModal() {
    setEditing(null);
    if (initial.newTicket || initial.openId) router.replace("/tickets");
  }
  function clearFilters() {
    setF({ assignee: "", client: "", prio: "", quick: "" });
    if (initial.filter || initial.assigneeId || initial.clientId || initial.mine) router.replace("/tickets");
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

  const comments = (t: TicketRow) => t.commentCount ? <span className="cmc" title={`${t.commentCount} comment${t.commentCount === 1 ? "" : "s"}`}><Icon name="chat" />{t.commentCount}</span> : null;
  const card = (t: TicketRow) => (
    <div key={t.id} className="card" draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => setEditing(t)}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setEditing(t); }}>
      <div className="meta"><span className="code">{ticketCode(t.number)}</span><span className="r">{comments(t)}<PrioGlyph priority={t.priority} /></span></div>
      <div className="t">{t.title}</div>
      <div className="meta"><span>{t.clientId ? clientById.get(t.clientId)?.name ?? "Client" : "Internal"}</span><span className="r"><DueChip due={t.dueDate} done={t.status === "DONE"} today={today} /><Avatar user={t.assigneeId ? userById.get(t.assigneeId) : null} /></span></div>
    </div>
  );
  const quickList = QUICK;

  return (
    <>
      <PageHead title="Tickets" sub="Create, assign and track work. Drag cards between columns to change their status.">
        <div className="seg">
          <button className={view === "board" ? "on" : ""} onClick={() => chooseView("board")}>Board</button>
          <button className={view === "list" ? "on" : ""} onClick={() => chooseView("list")}>List</button>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>+ New ticket</button>
      </PageHead>
      {!rows.length ? (
        <EmptyState title="No tickets yet" actions={<button className="btn primary" onClick={() => setEditing({})}>+ Create the first ticket</button>}>
          Tickets are how work gets assigned and tracked. Create one, give it a due date and pick who owns it.
        </EmptyState>
      ) : <>
      <div className="filters">
        <div className="quick">
          {quickList.map(([k, l]) => (
            <button key={k} className={f.quick === k ? "on" : ""} onClick={() => setF({ ...f, quick: f.quick === k ? "" : k })}>{l}<span className="c">{base.filter((t) => quickMatch(t, k)).length}</span></button>
          ))}
        </div>
        <div className="toolbar">
          <select aria-label="Filter by assignee" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
            <option value="">All assignees</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select aria-label="Filter by client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}>
            <option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Filter by priority" value={f.prio} onChange={(e) => setF({ ...f, prio: e.target.value })}>
            <option value="">All priorities</option>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {anyFilter ? <button className="btn sm ghost" onClick={clearFilters}>Clear filters</button> : null}
        </div>
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
                <h3><span className={`dot ${k.toLowerCase()}`} />{l}<span className="n">{items.length}</span></h3>
                {items.length ? items.map(card) : <div className="cempty">{anyFilter ? "No matching tickets" : "Drop tickets here"}</div>}
              </div>
            );
          })}
        </div>
      ) : !list.length ? (
        <EmptyState title="No tickets match" actions={<button className="btn" onClick={clearFilters}>Clear filters</button>}>Try a different filter, or clear them to see every ticket.</EmptyState>
      ) : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>ID</th><th>Title</th><th>Client</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {list.slice().sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE") || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9")).map((t) => (
                <tr key={t.id} onClick={() => setEditing(t)}>
                  <td className="code">{ticketCode(t.number)}</td>
                  <td>{t.title} {comments(t)}</td>
                  <td>{t.clientId ? clientById.get(t.clientId)?.name : "Internal"}</td>
                  <td>{t.assigneeId ? <span className="inl"><Avatar user={userById.get(t.assigneeId)} />{userById.get(t.assigneeId)?.name}</span> : <span className="code">Unassigned</span>}</td>
                  <td><span className="inl"><PrioGlyph priority={t.priority} />{label(PRIORITIES, t.priority)}</span></td>
                  <td><span className="inl"><span className={`dot ${t.status.toLowerCase()}`} />{label(TICKET_STATUSES, t.status)}</span></td>
                  <td><DueChip due={t.dueDate} done={t.status === "DONE"} today={today} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}

      {editing ? (
        <FormModal
          key={editing.id ?? "new"}
          title={editing.id ? `${ticketCode(editing.number!)} · ${editing.title}` : "New ticket"}
          submitLabel={editing.id ? "Save changes" : "Create ticket"}
          aside={editing.id ? <TicketThread ticketId={editing.id} users={users} onCommented={() => router.refresh()} /> : undefined}
          fields={fields}
          initial={{ status: "TODO", priority: "MEDIUM", ...editing }}
          onSubmit={async (v) => { const r = await saveTicket(editing.id ?? null, v); if (r.ok && !editing.id) toast("Ticket created."); return r; }}
          onDelete={editing.id && me.role === "ADMIN" ? () => deleteTicket(editing.id!) : undefined}
          onClose={closeModal}
        />
      ) : null}
    </>
  );
}
