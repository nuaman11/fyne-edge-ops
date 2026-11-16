"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertDeal, deleteDeal, saveDeal, setDealStage } from "@/app/actions/deals";
import { DEAL_STAGES, LOST_REASONS, SERVICES, label, type DealStage } from "@/lib/constants";
import { aed, fmtDate, plural, todayISO } from "@/lib/format";
import type { DealRow } from "@/lib/types";
import { EmptyState, PageHead, Pill } from "@/components/ui";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

export function PipelineView({ isAdmin, deals, initial }: { isAdmin: boolean; deals: DealRow[]; initial: { openId?: string; newDeal?: boolean } }) {
  const router = useRouter();
  const [rows, setRows] = useState(deals);
  useEffect(() => setRows(deals), [deals]);
  const [editing, setEditing] = useState<Partial<DealRow> | null>(
    (initial.openId ? deals.find((d) => d.id === initial.openId) : undefined) ?? (initial.newDeal && isAdmin ? { stage: "LEAD", service: "Website" } : null),
  );
  const [losing, setLosing] = useState<DealRow | null>(null);
  const closeEditor = () => { setEditing(null); if (initial.openId || initial.newDeal) router.replace("/pipeline"); };
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const today = todayISO();
  const openVal = rows.filter((d) => d.stage !== "WON" && d.stage !== "LOST").reduce((a, d) => a + d.value, 0);

  function move(id: string, stage: DealStage) {
    if (stage === "LOST") { const d = rows.find((x) => x.id === id); if (d) setLosing(d); return; }
    setRows((r) => r.map((d) => (d.id === id ? { ...d, stage, lostReason: null, lostNote: null } : d)));
    start(async () => { const r = await setDealStage(id, stage); if (!r.ok) { toast(r.error); setRows(deals); } });
  }
  function convert(d: DealRow) {
    start(async () => { const r = await convertDeal(d.id); toast(r.ok ? `${d.company} added to client onboarding.` : r.error); });
  }

  const fields: Field[] = [
    { name: "company", label: "Company", type: "text", required: true },
    { name: "contactName", label: "Contact person", type: "text" },
    { name: "service", label: "Service", type: "select", options: SERVICES.map((s) => [s, s] as const) },
    { name: "value", label: "Estimated value (AED)", type: "number" },
    { name: "stage", label: "Stage", type: "select", options: DEAL_STAGES },
    { name: "expectedClose", label: "Expected close date", type: "date" },
    { name: "source", label: "Source", type: "text", placeholder: "Referral, Instagram, website…" },
    { name: "nextAction", label: "Next action", type: "text" },
    { name: "lostReason", label: "Reason lost (needed when the stage is Lost)", type: "select", full: true, options: [["", "—"], ...LOST_REASONS] },
    { name: "notes", label: "Notes", type: "textarea", full: true },
  ];
  const lost = rows.filter((d) => d.stage === "LOST");
  const lostCounts = Object.entries(lost.reduce<Record<string, number>>((a, d) => { const k = d.lostReason ?? "none"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead title="Pipeline" sub={`Future clients and deals in progress · ${aed(openVal)} open`}>
        {isAdmin ? <button className="btn primary" onClick={() => setEditing({ stage: "LEAD", service: "Website" })}>+ New lead</button> : null}
      </PageHead>
      {!rows.length ? (
        <EmptyState title="Your pipeline is empty" actions={isAdmin ? <button className="btn primary" onClick={() => setEditing({ stage: "LEAD", service: "Website" })}>+ Add your first lead</button> : undefined}>
          {isAdmin ? "Add the companies you’re talking to. Drag them across stages as the conversation moves, and convert won deals into clients." : "Leads appear here once an admin adds them."}
        </EmptyState>
      ) : <>
      <div className="board">
        {DEAL_STAGES.map(([k, l]) => {
          const items = rows.filter((d) => d.stage === k);
          const tot = items.reduce((a, d) => a + d.value, 0);
          return (
            <div key={k} className={`col ${over === k ? "over" : ""}`}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(k); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); const d = rows.find((x) => x.id === dragId); if (d && d.stage !== k) move(d.id, k); setDragId(null); }}>
              <h3>{l}<span>{items.length} · {tot.toLocaleString("en-US")}</span></h3>
              {items.length ? items.map((d) => {
                const late = d.expectedClose && d.expectedClose < today && k !== "WON" && k !== "LOST";
                return (
                  <div key={d.id} className="card" draggable={isAdmin} onDragStart={() => setDragId(d.id)} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => setEditing(d)}>
                    <div className="t">{d.company}</div>
                    <div className="meta"><span>{d.service}</span><b style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{d.value ? aed(d.value) : ""}</b></div>
                    {d.nextAction && k !== "LOST" ? <div className="meta"><span>Next: {d.nextAction}</span></div> : null}
                    {k === "LOST"
                      ? <div className="meta"><Pill tone={d.lostReason ? "bad" : undefined}>{d.lostReason ? label(LOST_REASONS, d.lostReason) : "No reason given"}</Pill></div>
                      : <div className="meta"><span>{d.contactName ?? ""}</span>{d.expectedClose ? <span className={`due ${late ? "late" : ""}`}>{fmtDate(d.expectedClose)}</span> : null}</div>}
                    {k === "WON" ? (d.clientId ? <Pill tone="ok">Converted to client</Pill> : isAdmin ? <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); convert(d); }}>Convert to client</button> : null) : null}
                  </div>
                );
              }) : <div className="cempty">{isAdmin ? "Drag deals here" : "Empty"}</div>}
            </div>
          );
        })}
      </div>
      {lost.length ? (
        <section className="panel">
          <div className="ph"><h2>Why deals are lost <span className="n">{plural(lost.length, "deal")}</span></h2></div>
          <div className="lost-strip">{lostCounts.map(([r, n]) => <Pill key={r} tone={r === "none" ? undefined : "bad"}>{r === "none" ? "No reason given" : label(LOST_REASONS, r)} · {n}</Pill>)}</div>
        </section>
      ) : null}
      </>}
      {editing ? (
        <FormModal title={editing.id ? (isAdmin ? "Edit lead" : editing.company!) : "New lead"} fields={fields} initial={editing} readOnly={!isAdmin}
          submitLabel={editing.id ? "Save changes" : "Add lead"}
          onSubmit={(v) => { if (v.stage === "LOST" && !v.lostReason) return Promise.resolve({ ok: false as const, error: "Pick why the deal was lost." }); return saveDeal(editing.id ?? null, v); }}
          onDelete={editing.id && isAdmin ? () => deleteDeal(editing.id!) : undefined} onClose={closeEditor} />
      ) : null}
      {losing ? (
        <FormModal title={`Why was ${losing.company} lost?`} submitLabel="Mark as lost"
          fields={[
            { name: "lostReason", label: "Reason", type: "select", full: true, required: true, options: [["", "Choose a reason"], ...LOST_REASONS] },
            { name: "lostNote", label: "Anything else worth remembering? (optional)", type: "textarea", full: true },
          ]}
          initial={{ lostReason: "", lostNote: losing.lostNote ?? "" }}
          onSubmit={async (v) => {
            const r = await setDealStage(losing.id, "LOST", String(v.lostReason), String(v.lostNote || ""));
            if (r.ok) setRows((rs) => rs.map((d) => (d.id === losing.id ? { ...d, stage: "LOST", lostReason: String(v.lostReason), lostNote: String(v.lostNote || "") || null } : d)));
            return r;
          }}
          onClose={() => setLosing(null)} />
      ) : null}
    </>
  );
}
