"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { declineDocument, signDocument } from "@/app/actions/documents";
import { fmtDate, todayISO } from "@/lib/format";
import type { DocDetail } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { FormModal } from "@/components/FormModal";
import { PdfPages } from "@/components/docs/PdfPages";
import { SignaturePad } from "@/components/docs/SignaturePad";
import { fieldName, signerTone } from "@/components/docs/shared";

/** Signing view: the signer's boxes are highlighted; everyone else's are shown as they stand. */
export function DocumentSigner({ doc, me }: { doc: DocDetail; me: { id: string; name: string } }) {
  const router = useRouter();
  const signer = doc.signers.find((s) => s.userId === me.id)!;
  const mine = useMemo(() => doc.fields.filter((f) => f.signerId === signer.id).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), [doc.fields, signer.id]);
  const auto = (type: string) => (type === "DATE" ? fmtDate(todayISO(), true) : type === "NAME" ? signer.name : null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pad, setPad] = useState<{ fieldId: string; kind: "SIGNATURE" | "INITIALS" } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const needs = mine.filter((f) => f.required && !auto(f.type));
  const filledCount = needs.filter((f) => values[f.id]?.trim()).length;
  const ready = filledCount === needs.length;
  const signerIndex = (signerId: string) => doc.signers.findIndex((s) => s.id === signerId);

  function next() {
    const f = needs.find((x) => !values[x.id]?.trim()) ?? mine[0];
    if (!f) return;
    const el = document.querySelector<HTMLElement>(`[data-field="${f.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (f.type === "SIGNATURE" || f.type === "INITIALS") setTimeout(() => setPad({ fieldId: f.id, kind: f.type as "SIGNATURE" | "INITIALS" }), 350);
    else setTimeout(() => el?.querySelector("input")?.focus(), 350);
  }

  function adopt(png: string, all: boolean) {
    if (!pad) return;
    setValues((v) => {
      const out = { ...v, [pad.fieldId]: png };
      if (all) for (const f of mine) if (f.type === pad.kind) out[f.id] = png;
      return out;
    });
    setPad(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await signDocument(doc.id, { values: mine.map((f) => ({ fieldId: f.id, value: values[f.id] ?? null })), agreed });
      if (!r.ok) { setError(r.error); return; }
      toast("Signed. Thank you.");
      router.push(`/documents/${doc.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="signbar">
        <div className="grow">
          <b>{doc.title}</b>
          <span>{filledCount} of {needs.length} box{needs.length === 1 ? "" : "es"} filled{doc.message ? ` · ${doc.message}` : ""}</span>
        </div>
        <button type="button" className="btn sm ghost danger" onClick={() => setDeclining(true)}>Decline</button>
        {!ready ? <button type="button" className="btn primary" onClick={next}>{filledCount ? "Next box" : "Start"}</button>
          : <a className="btn primary" href="#finish" onClick={(e) => { e.preventDefault(); document.getElementById("finish")?.scrollIntoView({ behavior: "smooth" }); }}>Finish</a>}
      </div>

      <PdfPages src={`/api/documents/${doc.id}/file`}
        overlay={(page) => doc.fields.filter((f) => f.page === page).map((f) => {
          const isMine = f.signerId === signer.id;
          const style = { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` };
          if (!isMine) {
            const owner = doc.signers.find((s) => s.id === f.signerId);
            return (
              <div key={f.id} className={`fbox other tone-${signerTone(signerIndex(f.signerId))}`} style={style} title={`${fieldName(f.type)} for ${owner?.name}`}>
                {f.value ? (f.value.startsWith("data:image") ? <img src={f.value} alt={`${owner?.name}'s ${fieldName(f.type).toLowerCase()}`} /> : <span className="fval">{f.value}</span>)
                  : <span className="fbox-t">{owner?.name.split(" ")[0]}</span>}
              </div>
            );
          }
          const a = auto(f.type);
          const v = values[f.id];
          if (a) return <div key={f.id} data-field={f.id} className="fbox mine filled" style={style}><span className="fval">{a}</span></div>;
          if (f.type === "TEXT") return (
            <div key={f.id} data-field={f.id} className={`fbox mine ${v?.trim() ? "filled" : ""}`} style={style}>
              <input aria-label={f.label || "Text"} placeholder={`${f.label || "Text"}${f.required ? " *" : ""}`} value={v ?? ""} maxLength={500}
                onChange={(e) => setValues((x) => ({ ...x, [f.id]: e.target.value }))} />
            </div>
          );
          return (
            <button key={f.id} type="button" data-field={f.id} className={`fbox mine ${v ? "filled" : ""}`} style={style}
              onClick={() => setPad({ fieldId: f.id, kind: f.type as "SIGNATURE" | "INITIALS" })}>
              {v ? <img src={v} alt={`Your ${fieldName(f.type).toLowerCase()}`} /> : <span className="fbox-t">{f.type === "INITIALS" ? "Initial here" : "Sign here"}</span>}
            </button>
          );
        })} />

      <section className="panel finish" id="finish">
        <div className="ph"><h2>Finish signing</h2><span className="fine">{filledCount} of {needs.length} filled</span></div>
        <label className="chk">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I agree that my electronic signature is the legal equivalent of my handwritten signature on this document.
        </label>
        {error ? <div className="err" role="alert">{error}</div> : null}
        <div className="doc-actions">
          <Link className="btn ghost" href={`/documents/${doc.id}`}>Not now</Link>
          {!ready ? <button type="button" className="btn" onClick={next}>Go to the next box</button> : null}
          <button type="button" className="btn primary" disabled={!ready || !agreed || pending} onClick={submit}>{pending ? "Signing…" : "Sign document"}</button>
        </div>
      </section>

      {pad ? <SignaturePad kind={pad.kind} name={signer.name} userId={me.id} onDone={adopt} onClose={() => setPad(null)} /> : null}
      {declining ? (
        <FormModal title="Decline to sign" submitLabel="Decline"
          intro={<p className="mtext">The document will be voided and the sender will see your reason. They can send a corrected version.</p>}
          fields={[{ name: "reason", label: "Why are you declining?", type: "textarea", full: true, required: true }]}
          onSubmit={async (v) => { const r = await declineDocument(doc.id, v.reason); if (r.ok) { toast("You declined this document."); router.push(`/documents/${doc.id}`); router.refresh(); } return r; }}
          onClose={() => setDeclining(false)} />
      ) : null}
    </>
  );
}
