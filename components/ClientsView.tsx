"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { assignDevelopers, deleteClient, saveClient, setClientStage, toggleChecklist } from "@/app/actions/clients";
import { CLIENT_STAGES, CLOSING_ITEMS, ONBOARDING_ITEMS, SERVICES, label, type ClientStage } from "@/lib/constants";
import { aed, fmtDate, todayISO } from "@/lib/format";
import type { ClientRow, UserLite } from "@/lib/types";
import { Avatar, Bar, PageHead, Pill } from "@/components/ui";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

export function ClientsView({ isAdmin, clients, users, openByClient }: {
  isAdmin: boolean; clients: ClientRow[]; users: UserLite[]; openByClient: Record<string, number>;
}) {
  const [rows, setRows] = useState(clients);
  useEffect(() => setRows(clients), [clients]);
  const [tab, setTab] = useState<ClientStage>("ONBOARDING");
  const [editing, setEditing] = useState<Partial<ClientRow> | null>(null);
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
    const open = openByClient[c.id] ?? 0;
    if (c.stage === "ONBOARDING") {
      const ready = ONBOARDING_ITEMS.every(([k]) => c.onboarding[k]) && c.developerIds.length > 0;
      return { body: <>{checklist(c, "onboarding")}{devBlock(c)}</>, foot: isAdmin ? <>
        <button className="btn sm" onClick={() => setAssigning(c)}>Assign developers</button>
        <button className="btn sm primary" disabled={!ready} title={ready ? "" : "Finish the checklist and assign at least one developer"} onClick={() => act(() => setClientStage(c.id, "ACTIVE"))}>Mark active</button>
      </> : null };
    }
    if (c.stage === "ACTIVE") return { body: <>{devBlock(c)}<div className="toolbar"><Pill>{open} open ticket{open === 1 ? "" : "s"}</Pill>{c.startDate ? <Pill>Since {fmtDate(c.startDate, true)}</Pill> : null}</div></>, foot: <>
      {isAdmin ? <button className="btn sm" onClick={() => setAssigning(c)}>Assign developers</button> : null}
      <Link className="btn sm" href={`/tickets?client=${c.id}`}>View tickets</Link>
      {isAdmin ? <button className="btn sm primary" onClick={() => act(() => setClientStage(c.id, "CLOSING"))}>Start closing</button> : null}
    </> };
    if (c.stage === "CLOSING") {
      const ready = CLOSING_ITEMS.every(([k]) => c.closing[k]);
      return { body: <>{checklist(c, "closing")}{open ? <div className="notice">{open} ticket{open > 1 ? "s are" : " is"} still open for this client.</div> : null}</>, foot: isAdmin ? <>
        <button className="btn sm ghost" onClick={() => act(() => setClientStage(c.id, "ACTIVE"))}>Back to active</button>
        <button className="btn sm primary" disabled={!ready} title={ready ? "" : "Complete the closing checklist first"} onClick={() => act(() => setClientStage(c.id, "CLOSED"))}>Close client</button>
      </> : null };
    }
    return { body: <div className="toolbar"><Pill tone="ok">Closed {fmtDate(c.closedAt, true)}</Pill><div className="avs">{c.developerIds.map((id) => <Avatar key={id} user={userById.get(id)} />)}</div></div>,
      foot: isAdmin ? <button className="btn sm ghost" onClick={() => act(() => setClientStage(c.id, "ACTIVE"))}>Reopen</button> : null };
  }

  const list = rows.filter((c) => c.stage === tab);
  const fields: Field[] = [
    { name: "name", label: "Client / company name", type: "text", full: true, required: true },
    { name: "contactName", label: "Contact person", type: "text" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "email", label: "Email", type: "email" },
    { name: "service", label: "Service", type: "select", options: SERVICES.map((s) => [s, s] as const) },
    { name: "value", label: "Project value (AED)", type: "number" },
    { name: "startDate", label: "Kickoff date", type: "date" },
    { name: "leadId", label: "Project lead", type: "select", options: [["", "None"], ...users.filter((u) => u.active).map((u) => [u.id, u.name] as const)] },
    { name: "notes", label: "Notes", type: "textarea", full: true },
  ];

  return (
    <>
      <PageHead title="Clients" sub="Onboard new clients, assign developers, and work through closing.">
        {isAdmin ? <button className="btn primary" onClick={() => setEditing({ startDate: todayISO(), service: "Website" })}>+ New client</button> : null}
      </PageHead>
      <div className="tabs">
        {CLIENT_STAGES.map(([k, l]) => <button key={k} className={k === tab ? "on" : ""} onClick={() => setTab(k)}>{l}<span className="n">{rows.filter((c) => c.stage === k).length}</span></button>)}
      </div>
      {!list.length ? <div className="empty">No clients in {label(CLIENT_STAGES, tab).toLowerCase()}.{tab === "ONBOARDING" && isAdmin ? " Add one, or convert a won deal from the Pipeline." : ""}</div> : (
        <div className="cards">
          {list.map((c) => {
            const { body, foot } = cardBody(c);
            const lead = c.leadId ? userById.get(c.leadId) : null;
            return (
              <article className="rec" key={c.id}>
                <div className="hd">
                  <div><h3>{c.name}</h3><div className="sub">{c.service}{c.contactName ? ` · ${c.contactName}` : ""}{lead ? ` · Lead ${lead.name}` : ""}</div></div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{c.value ? aed(c.value) : ""}</div>
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
          onSubmit={(v) => saveClient(editing.id ?? null, v)} onDelete={editing.id && isAdmin ? () => deleteClient(editing.id!) : undefined} onClose={() => setEditing(null)} />
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
    </>
  );
}
