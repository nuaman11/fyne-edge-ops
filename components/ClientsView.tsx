"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignDevelopers, deleteClient, saveClient, setClientStage, toggleChecklist } from "@/app/actions/clients";
import { CLIENT_STAGES, CLOSING_ITEMS, ONBOARDING_ITEMS, SERVICES, label, type ClientStage } from "@/lib/constants";
import { aed, fmtDate, plural, todayISO } from "@/lib/format";
import type { ClientRow, UserLite } from "@/lib/types";
import { Avatar, Bar, EmptyState, PageHead, Pill } from "@/components/ui";
import { ResolveTicketsModal, type ResolveTicket } from "@/components/ResolveTicketsModal";

export type OpenTicket = ResolveTicket & { clientId: string | null };
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

export function ClientsView({ isAdmin, clients, users, openByClient, initial }: {
  isAdmin: boolean; clients: ClientRow[]; users: UserLite[]; openByClient: Record<string, OpenTicket[]>;
  initial: { tab?: string; openId?: string; newClient?: boolean };
}) {
  const router = useRouter();
  const [rows, setRows] = useState(clients);
  useEffect(() => setRows(clients), [clients]);
  const opened = initial.openId ? clients.find((c) => c.id === initial.openId) : undefined;
  const [tab, setTab] = useState<ClientStage>(
    opened?.stage ?? (CLIENT_STAGES.some(([k]) => k === initial.tab) ? (initial.tab as ClientStage) : "ONBOARDING"),
  );
  const [editing, setEditing] = useState<Partial<ClientRow> | null>(
    opened ?? (initial.newClient && isAdmin ? { startDate: todayISO(), service: "Website", stage: "ONBOARDING" } : null),
  );
  const [resolving, setResolving] = useState<{ client: ClientRow; closeAfter: boolean } | null>(null);
  const closeEditor = () => { setEditing(null); if (initial.openId || initial.newClient) router.replace("/clients"); };
  const [assigning, setAssigning] = useState<ClientRow | null>(null);
  const [, start] = useTransition();
  const userById = new Map(users.map((u) => [u.id, u]));
  const devPool = users.filter((u) => u.active && (u.department === "Engineering" || u.department === "Design"));

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) toast(r.error || "Couldn’t save."); });

  function tick(c: ClientRow, kind: "onboarding" | "closing", key: string, value: boolean) {
    setRows((rs) => rs.map((x) => (x.id === c.id ? { ...x, [kind]: { ...x[kind], [key]: value } } : x)));
    start(async () => {
      const r = await toggleChecklist(c.id, kind, key, value);
      if (!r.ok) { toast(r.error); setRows(clients); }
    });
  }

  const checklist = (c: ClientRow, kind: "onboarding" | "closing") => {
    const items = kind === "onboarding" ? ONBOARDING_ITEMS : CLOSING_ITEMS;
    const st = c[kind];
    const done = items.filter(([k]) => st[k]).length;
    return (
      <div>
        <div className="lbl" style={{ display: "flex", justifyContent: "space-between" }}><span>{kind === "onboarding" ? "Onboarding" : "Closing"} checklist</span><span>{done}/{items.length}</span></div>
        <div style={{ marginBottom: 8 }}><Bar value={done} max={items.length} /></div>
        <div className="checks">
          {items.map(([k, l]) => (
            <label key={k} className={st[k] ? "done" : ""}>
              <input type="checkbox" checked={!!st[k]} onChange={(e) => tick(c, kind, k, e.target.checked)} /><span>{l}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const devBlock = (c: ClientRow) => (
    <div>
      <div className="lbl">Developers</div>
      <div className="avs">
        {c.developerIds.length ? c.developerIds.map((id) => { const u = userById.get(id); return u ? <span className="chip" key={id}><Avatar user={u} />{u.name}</span> : null; }) : <span className="code">None assigned yet</span>}
      </div>
    </div>
  );

  function cardBody(c: ClientRow) {
    const openList = openByClient[c.id] ?? [];
    const open = openList.length;
    if (c.stage === "ONBOARDING") {
      const ready = ONBOARDING_ITEMS.every(([k]) => c.onboarding[k]) && c.developerIds.length > 0;
      return { body: <>{checklist(c, "onboarding")}{devBlock(c)}</>, foot: isAdmin ? <>
        <button className="btn sm" onClick={() => setAssigning(c)}>Assign developers</button>
        <button className="btn sm primary" disabled={!ready} title={ready ? "" : "Finish the checklist and assign at least one developer"} onClick={() => act(() => setClientStage(c.id, "ACTIVE"))}>Mark active</button>
      </> : null };
    }
    if (c.stage === "ACTIVE") return { body: <>{devBlock(c)}<div className="toolbar"><Pill>{plural(open, "open ticket")}</Pill>{c.startDate ? <Pill>Since {fmtDate(c.startDate, true)}</Pill> : null}</div></>, foot: <>
      {isAdmin ? <button className="btn sm" onClick={() => setAssigning(c)}>Assign developers</button> : null}
      <Link className="btn sm" href={`/tickets?client=${c.id}`}>View tickets</Link>
      {isAdmin ? <button className="btn sm primary" onClick={() => act(() => setClientStage(c.id, "CLOSING"))}>Start closing</button> : null}
    </> };
    if (c.stage === "CLOSING") {
      const ready = CLOSING_ITEMS.every(([k]) => c.closing[k]);
      return { body: <>{checklist(c, "closing")}{open ? <div className="notice"><span>{plural(open, "ticket")} still open for this client.</span>{isAdmin ? <button className="btn sm" onClick={() => setResolving({ client: c, closeAfter: false })}>Sort them out</button> : null}</div> : null}</>, foot: isAdmin ? <>
        <button className="btn sm ghost" onClick={() => act(() => setClientStage(c.id, "ACTIVE"))}>Back to active</button>
        <button className="btn sm primary" disabled={!ready} title={ready ? "" : "Complete the closing checklist first"}
          onClick={() => (open ? setResolving({ client: c, closeAfter: true }) : act(() => setClientStage(c.id, "CLOSED")))}>Close client</button>
      </> : null };
    }
    return { body: <div className="toolbar"><Pill tone="ok">Closed {fmtDate(c.closedAt, true)}</Pill><div className="avs">{c.developerIds.map((id) => <Avatar key={id} user={userById.get(id)} />)}</div></div>,
      foot: <>
        {isAdmin ? <button className="btn sm ghost" onClick={() => act(() => setClientStage(c.id, "ACTIVE"))}>Reopen</button> : null}
        <Link className="btn sm" href={`/projects?new=1&client=${c.id}`}>Add to Projects</Link>
      </> };
  }

  const list = rows.filter((c) => c.stage === tab);
  const has = (st: ClientStage) => rows.some((c) => c.stage === st);
  function emptyFor(st: ClientStage) {
    if (st === "ONBOARDING") return (
      <EmptyState title="No clients being onboarded" actions={isAdmin ? <>
        <button className="btn primary" onClick={() => setEditing({ startDate: todayISO(), service: "Website", stage: "ONBOARDING" })}>+ New client</button>
        <Link className="btn" href="/pipeline">Open pipeline</Link></> : undefined}>
        {isAdmin ? "Add a client yourself, or win a deal in the Pipeline and convert it. Each new client starts here with an onboarding checklist." : "New clients appear here with their onboarding checklist once an admin adds them."}
      </EmptyState>);
    if (st === "ACTIVE") return (
      <EmptyState title="No active clients" actions={has("ONBOARDING") ? <button className="btn" onClick={() => setTab("ONBOARDING")}>See onboarding</button> : undefined}>
        A client moves here once its onboarding checklist is complete and at least one developer is assigned.
      </EmptyState>);
    if (st === "CLOSING") return (
      <EmptyState title="Nobody is closing right now" actions={has("ACTIVE") ? <button className="btn" onClick={() => setTab("ACTIVE")}>See active clients</button> : undefined}>
        When a project is wrapping up, press Start closing on an active client to run the closing checklist.
      </EmptyState>);
    return <EmptyState title="No closed clients yet">Finished projects are kept here for reference, and you can reopen them if work restarts.</EmptyState>;
  }
  const fields: Field[] = [
    { name: "name", label: "Client / company name", type: "text", full: true, required: true },
    { name: "contactName", label: "Contact person", type: "text" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "email", label: "Email", type: "email" },
    { name: "service", label: "Service", type: "select", options: SERVICES.map((s) => [s, s] as const) },
    { name: "value", label: "Project value (AED)", type: "number" },
    { name: "startDate", label: "Kickoff date", type: "date" },
    { name: "leadId", label: "Project lead", type: "select", options: [["", "None"], ...users.filter((u) => u.active).map((u) => [u.id, u.name] as const)] },
    { name: "stage", label: "Stage", type: "select", options: CLIENT_STAGES, help: "Pick Active, Closing or Closed to add an existing or past client." },
    { name: "closedAt", label: "Closed date (for closed clients)", type: "date", help: "Leave empty to use today." },
    { name: "notes", label: "Notes", type: "textarea", full: true },
  ];

  return (
    <>
      <PageHead title="Clients" sub="Onboard new clients, assign developers, and work through closing.">
        {isAdmin ? <button className="btn primary" onClick={() => setEditing({ startDate: todayISO(), service: "Website", stage: tab })}>+ New client</button> : null}
      </PageHead>
      <div className="tabs">
        {CLIENT_STAGES.map(([k, l]) => <button key={k} className={k === tab ? "on" : ""} onClick={() => setTab(k)}>{l}<span className="n">{rows.filter((c) => c.stage === k).length}</span></button>)}
      </div>
      {!list.length ? emptyFor(tab) : (
        <div className="cards">
          {list.map((c) => {
            const { body, foot } = cardBody(c);
            const lead = c.leadId ? userById.get(c.leadId) : null;
            return (
              <article className="rec" key={c.id}>
                <ol className="stepper" aria-label={`Stage: ${label(CLIENT_STAGES, c.stage)}`}>
                  {CLIENT_STAGES.map(([k, l], j) => {
                    const i = CLIENT_STAGES.findIndex(([x]) => x === c.stage);
                    return <li key={k} className={j < i || c.stage === "CLOSED" ? "past" : j === i ? "now" : ""}>{l}</li>;
                  })}
                </ol>
                <div className="hd">
                  <div><h3>{c.name}</h3><div className="sub">{c.service}{c.contactName ? ` · ${c.contactName}` : ""}{lead ? ` · Lead ${lead.name}` : ""}</div></div>
                  <div style={{ textAlign: "right" }}>
                    <div className="val">{c.value ? aed(c.value) : ""}</div>
                    <button className="btn sm ghost" onClick={() => setEditing(c)}>{isAdmin ? "Edit" : "Details"}</button>
                  </div>
                </div>
                {body}
                {foot ? <div className="foot">{foot}</div> : null}
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <FormModal title={editing.id ? (isAdmin ? "Edit client" : editing.name!) : "New client"} fields={fields} initial={editing} readOnly={!isAdmin}
          onSubmit={async (v) => { const r = await saveClient(editing.id ?? null, v); if (r.ok) setTab(v.stage as ClientStage); return r; }}
          onDelete={editing.id && isAdmin ? () => deleteClient(editing.id!) : undefined} onClose={closeEditor} />
      ) : null}
      {assigning ? (
        <FormModal title={`Assign developers · ${assigning.name}`} submitLabel="Save assignment"
          fields={[{ name: "devs", label: "Developers & designers", type: "multi", full: true, options: devPool.map((u) => {
            const load = rows.filter((x) => x.stage !== "CLOSED" && x.id !== assigning.id && x.developerIds.includes(u.id)).length;
            return [u.id, `${u.name} (${load} other client${load === 1 ? "" : "s"})`] as const;
          }), help: devPool.length ? undefined : "Add users in the Engineering or Design department first." }]}
          initial={{ devs: assigning.developerIds }}
          onSubmit={(v) => assignDevelopers(assigning.id, v.devs as string[])} onClose={() => setAssigning(null)} />
      ) : null}
      {resolving ? (
        <ResolveTicketsModal client={resolving.client} tickets={openByClient[resolving.client.id] ?? []} users={users} closeAfter={resolving.closeAfter}
          onClose={() => setResolving(null)} />
      ) : null}
    </>
  );
}
