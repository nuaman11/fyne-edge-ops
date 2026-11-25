"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveDocumentSetup, sendDocument } from "@/app/actions/documents";
import { FIELD_TYPES, type FieldType } from "@/lib/constants";
import type { DocDetail, UserLite } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { PdfPages, type PageSize } from "@/components/docs/PdfPages";
import { fieldName, signerTone } from "@/components/docs/shared";

type EField = { key: string; signerUserId: string; type: FieldType; page: number; x: number; y: number; w: number; h: number; required: boolean; label: string };
let seq = 0;
const k = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Draft editor: choose signers, then click on the pages to drop signature, date and text boxes for each person. */
export function DocumentEditor({ doc, users, clients }: { doc: DocDetail; users: UserLite[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [message, setMessage] = useState(doc.message ?? "");
  const [clientId, setClientId] = useState(doc.clientId ?? "");
  const [signers, setSigners] = useState<string[]>(doc.signers.map((s) => s.userId).filter((x): x is string => !!x));
  const signerUserBySignerId = new Map(doc.signers.map((s) => [s.id, s.userId]));
  const [fields, setFields] = useState<EField[]>(() => doc.fields.flatMap((f) => {
    const u = signerUserBySignerId.get(f.signerId);
    return u ? [{ key: k(), signerUserId: u, type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, required: f.required, label: f.label ?? "" }] : [];
  }));
  const [current, setCurrent] = useState<string>(signers[0] ?? "");
  const [tool, setTool] = useState<FieldType | null>(signers.length ? "SIGNATURE" : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const touch = () => setDirty(true);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const people = users.filter((u) => u.active && !signers.includes(u.id));
  const sel = fields.find((f) => f.key === selected) ?? null;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); removeField(selected); }
      if (e.key === "Escape") { setSelected(null); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  });

  function addSigner(id: string) {
    if (!id || signers.includes(id)) return;
    setSigners((s) => [...s, id]); setCurrent(id); setTool("SIGNATURE"); touch();
  }
  function removeSigner(id: string) {
    const n = fields.filter((f) => f.signerUserId === id).length;
    setSigners((s) => s.filter((x) => x !== id));
    setFields((fs) => fs.filter((f) => f.signerUserId !== id));
    if (current === id) setCurrent(signers.find((x) => x !== id) ?? "");
    if (n) toast(`Removed ${userById.get(id)?.name ?? "signer"} and their ${n} box${n === 1 ? "" : "es"}.`);
    touch();
  }

  const place = useCallback((page: number, cx: number, cy: number) => {
    if (!tool) { setSelected(null); return; }
    if (!current) { toast("Add a signer first."); return; }
    const size = sizes[page - 1];
    if (!size) return;
    const def = FIELD_TYPES.find(([t]) => t === tool)!;
    const w = Math.min(def[2] / size.w, 0.9), h = Math.min(def[3] / size.h, 0.3);
    const f: EField = { key: k(), signerUserId: current, type: tool, page, w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), required: true, label: tool === "TEXT" ? "Text" : "" };
    setFields((fs) => [...fs, f]); setSelected(f.key); touch();
  }, [tool, current, sizes]);

  function update(key: string, patch: Partial<EField>) { setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f))); touch(); }
  function removeField(key: string) { setFields((fs) => fs.filter((f) => f.key !== key)); setSelected(null); touch(); }

  /** Drag to move, or drag the corner to resize. Works with mouse, pen and touch. */
  function startDrag(e: React.PointerEvent, f: EField, mode: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    setSelected(f.key);
    const pageEl = (e.currentTarget as HTMLElement).closest(".pdf-page") as HTMLElement;
    const r = pageEl.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, o = { ...f };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height;
      if (mode === "move") update(f.key, { x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h) });
      else update(f.key, { w: clamp(o.w + dx, 0.02, 1 - o.x), h: clamp(o.h + dy, 0.012, 1 - o.y) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function payload() {
    return {
      title, message, clientId: clientId || null, signerUserIds: signers,
      fields: fields.map((f) => ({ signerUserId: f.signerUserId, type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, required: f.required, label: f.type === "TEXT" ? f.label : null })),
    };
  }
  function save(thenSend: boolean) {
    setError(null);
    start(async () => {
      const r = await saveDocumentSetup(doc.id, payload());
      if (!r.ok) { setError(r.error); return; }
      setDirty(false);
      if (!thenSend) { toast("Draft saved."); router.refresh(); return; }
      const s = await sendDocument(doc.id);
      if (!s.ok) { setError(s.error); return; }
      toast("Sent for signing.");
      router.push(`/documents/${doc.id}`);
    });
  }

  const countFor = (uid: string) => fields.filter((f) => f.signerUserId === uid).length;
  const sigFor = (uid: string) => fields.some((f) => f.signerUserId === uid && f.type === "SIGNATURE");

  return (
    <div className="doc-editor">
      <div className="doc-canvas">
        <div className="doc-hint">
          {tool && current
            ? <>Click on a page to add a <b>{fieldName(tool)}</b> box for <b>{userById.get(current)?.name}</b>. Drag boxes to move them; drag the corner to resize.</>
            : signers.length ? "Pick a box type on the right, then click on a page." : "Add the people who need to sign, on the right."}
        </div>
        <PdfPages src={`/api/documents/${doc.id}/file`} onSizes={setSizes} onPageClick={place}
          overlay={(page) => fields.filter((f) => f.page === page).map((f) => {
            const tone = signerTone(signers.indexOf(f.signerUserId));
            return (
              <div key={f.key} className={`fbox tone-${tone} ${selected === f.key ? "on" : ""}`}
                style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
                onPointerDown={(e) => startDrag(e, f, "move")} role="button" tabIndex={0} aria-label={`${fieldName(f.type)} for ${userById.get(f.signerUserId)?.name}`}
                onKeyDown={(e) => { if (e.key === "Enter") setSelected(f.key); }}>
                <span className="fbox-t">{f.type === "TEXT" ? f.label || "Text" : fieldName(f.type)}</span>
                <span className="fbox-who">{userById.get(f.signerUserId)?.name.split(" ")[0]}</span>
                {selected === f.key ? <>
                  <button type="button" className="fbox-x" aria-label="Delete box" onPointerDown={(e) => { e.stopPropagation(); removeField(f.key); }}>×</button>
                  <span className="fbox-rs" onPointerDown={(e) => startDrag(e, f, "resize")} aria-hidden="true" />
                </> : null}
              </div>
            );
          })} />
      </div>

      <aside className="doc-side">
        <section className="panel">
          <div className="ph"><h2>Document</h2>{dirty ? <span className="pill warn">Unsaved</span> : <span className="pill">Saved</span>}</div>
          <div className="form" style={{ gridTemplateColumns: "1fr" }}>
            <div className="f"><label className="l" htmlFor="d-title">Title</label><input id="d-title" type="text" value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} /></div>
            <div className="f"><label className="l" htmlFor="d-client">Client (optional)</label>
              <select id="d-client" value={clientId} onChange={(e) => { setClientId(e.target.value); touch(); }}>
                <option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="f"><label className="l" htmlFor="d-msg">Note to signers (optional)</label><textarea id="d-msg" value={message} onChange={(e) => { setMessage(e.target.value); touch(); }} placeholder="e.g. Please sign by Thursday." /></div>
          </div>
        </section>

        <section className="panel">
          <div className="ph"><h2>Signers <span className="n">{signers.length}</span></h2></div>
          <div className="signer-list">
            {signers.map((uid, i) => (
              <div key={uid} className={`signer-row ${current === uid ? "on" : ""}`} onClick={() => { setCurrent(uid); if (!tool) setTool("SIGNATURE"); }} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setCurrent(uid); }}>
                <span className={`sdot tone-${signerTone(i)}`} />
                <div className="grow"><b>{userById.get(uid)?.name ?? "Former user"}</b><span>{countFor(uid)} box{countFor(uid) === 1 ? "" : "es"}{sigFor(uid) ? "" : " · needs a signature box"}</span></div>
                <button type="button" className="btn sm ghost" aria-label={`Remove ${userById.get(uid)?.name}`} onClick={(e) => { e.stopPropagation(); removeSigner(uid); }}>Remove</button>
              </div>
            ))}
          </div>
          {people.length ? (
            <select aria-label="Add a signer" value="" onChange={(e) => addSigner(e.target.value)} className="add-signer">
              <option value="">+ Add a signer…</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
            </select>
          ) : null}
        </section>

        <section className="panel">
          <div className="ph"><h2>Add boxes</h2>{current ? <span className="fine">for {userById.get(current)?.name.split(" ")[0]}</span> : null}</div>
          <div className="tools">
            {FIELD_TYPES.map(([t, l]) => (
              <button key={t} type="button" className={`tool ${tool === t ? "on" : ""}`} disabled={!current} aria-pressed={tool === t} onClick={() => setTool(t)}>{l}</button>
            ))}
          </div>
          <p className="fine" style={{ margin: "8px 0 0" }}>Date signed and Full name fill in automatically when the person signs.</p>
        </section>

        {sel ? (
          <section className="panel">
            <div className="ph"><h2>Selected box</h2><button type="button" className="btn sm danger" onClick={() => removeField(sel.key)}>Delete</button></div>
            <div className="form" style={{ gridTemplateColumns: "1fr" }}>
              <div className="f"><label className="l" htmlFor="s-who">Who fills it</label>
                <select id="s-who" value={sel.signerUserId} onChange={(e) => update(sel.key, { signerUserId: e.target.value })}>
                  {signers.map((uid) => <option key={uid} value={uid}>{userById.get(uid)?.name}</option>)}
                </select></div>
              {sel.type === "TEXT" ? <>
                <div className="f"><label className="l" htmlFor="s-label">Label</label><input id="s-label" type="text" value={sel.label} maxLength={80} onChange={(e) => update(sel.key, { label: e.target.value })} placeholder="e.g. Job title" /></div>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={sel.required} onChange={(e) => update(sel.key, { required: e.target.checked })} /> Required</label>
              </> : null}
              <p className="fine" style={{ margin: 0 }}>Page {sel.page}. Press Delete to remove it.</p>
            </div>
          </section>
        ) : null}

        {error ? <div className="err" role="alert">{error}</div> : null}
        <div className="doc-actions">
          <Link className="btn ghost" href={`/documents/${doc.id}`}>Back</Link>
          <button type="button" className="btn" disabled={pending} onClick={() => save(false)}>Save draft</button>
          <button type="button" className="btn primary" disabled={pending || !signers.length} onClick={() => save(true)}>{pending ? "Working…" : "Send for signing"}</button>
        </div>
      </aside>
    </div>
  );
}
