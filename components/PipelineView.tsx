"use client";

import { useEffect, useState, useTransition } from "react";
import { convertDeal, deleteDeal, saveDeal, setDealStage } from "@/app/actions/deals";
import { DEAL_STAGES, SERVICES, type DealStage } from "@/lib/constants";
import { aed, fmtDate, todayISO } from "@/lib/format";
import type { DealRow } from "@/lib/types";
import { PageHead, Pill } from "@/components/ui";
import { FormModal, type Field } from "@/components/FormModal";
import { toast } from "@/components/Toaster";

export function PipelineView({ isAdmin, deals }: { isAdmin: boolean; deals: DealRow[] }) {
  const [rows, setRows] = useState(deals);
  useEffect(() => setRows(deals), [deals]);
  const [editing, setEditing] = useState<Partial<DealRow> | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const today = todayISO();
  const openVal = rows.filter((d) => d.stage !== "WON" && d.stage !== "LOST").reduce((a, d) => a + d.value, 0);

  function move(id: string, stage: DealStage) {
    setRows((r) => r.map((d) => (d.id === id ? { ...d, stage } : d)));
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
    { name: "notes", label: "Notes", type: "textarea", full: true },
  ];

  return (
    <>
      <PageHead title="Pipeline" sub={`Future clients and deals in progress · ${aed(openVal)} open`}>
        {isAdmin ? <button className="btn primary" onClick={() => setEditing({ stage: "LEAD", service: "Website" })}>+ New lead</button> : null}
      </PageHead>
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
                    {d.nextAction ? <div className="meta"><span>Next: {d.nextAction}</span></div> : null}
                    <div className="meta"><span>{d.contactName ?? ""}</span>{d.expectedClose ? <span className={late ? "late" : ""}>{fmtDate(d.expectedClose)}</span> : null}</div>
                    {k === "WON" ? (d.clientId ? <Pill tone="ok">Converted to client</Pill> : isAdmin ? <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); convert(d); }}>Convert to client</button> : null) : null}
                  </div>
                );
              }) : <div className="empty" style={{ textAlign: "center" }}>Empty</div>}
            </div>
          );
        })}
      </div>
      {editing ? (
        <FormModal title={editing.id ? (isAdmin ? "Edit lead" : editing.company!) : "New lead"} fields={fields} initial={editing} readOnly={!isAdmin}
          onSubmit={(v) => saveDeal(editing.id ?? null, v)} onDelete={editing.id && isAdmin ? () => deleteDeal(editing.id!) : undefined} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
