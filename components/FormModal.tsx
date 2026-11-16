"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-types";

export type Option = readonly [string, string];
export type Field =
  | { name: string; label: string; type: "text" | "email" | "password" | "number" | "date"; required?: boolean; full?: boolean; placeholder?: string; help?: string }
  | { name: string; label: string; type: "textarea"; full?: boolean; placeholder?: string; help?: string; required?: boolean }
  | { name: string; label: string; type: "select"; options: readonly Option[]; full?: boolean; help?: string; required?: boolean }
  | { name: string; label: string; type: "multi"; options: readonly Option[]; full?: boolean; help?: string; required?: boolean }
  | { name: string; label: string; type: "checkbox"; full?: boolean; help?: string; required?: boolean };

export type Values = Record<string, unknown>;

type Props = {
  title: string;
  fields: Field[];
  initial?: Values;
  onSubmit?: (v: Values) => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
  deleteLabel?: string;
  submitLabel?: string;
  readOnly?: boolean;
  onClose: () => void;
  footerExtra?: React.ReactNode;
  /** Extra panel shown beside the form (e.g. comments), which makes the window wider. */
  aside?: React.ReactNode;
  /** Short text shown above the fields. */
  intro?: React.ReactNode;
};

export function FormModal({ title, fields, initial = {}, onSubmit, onDelete, deleteLabel = "Delete", submitLabel = "Save", readOnly, onClose, footerExtra, aside, intro }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const [askDiscard, setAskDiscard] = useState(false);

  /** Something typed but not saved: changed fields, or an unsent draft (any element marked data-draft) beside the form. */
  const hasUnsaved = () => {
    if (readOnly) return false;
    const draft = modalRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>("[data-draft]");
    return dirty.current || !!draft?.value.trim();
  };
  const requestClose = useRef<() => void>(() => {});
  requestClose.current = () => { if (hasUnsaved()) setAskDiscard(true); else onClose(); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); requestClose.current(); } };
    document.addEventListener("keydown", k);
    formRef.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    return () => document.removeEventListener("keydown", k);
  }, []);

  function collect(): Values {
    const fd = new FormData(formRef.current!);
    const out: Values = {};
    for (const f of fields) {
      if (f.type === "multi") out[f.name] = fd.getAll(f.name).map(String);
      else if (f.type === "checkbox") out[f.name] = fd.get(f.name) === "on";
      else out[f.name] = String(fd.get(f.name) ?? "").trim();
    }
    return out;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit || readOnly) return;
    const v = collect();
    for (const f of fields) {
      if (f.required && (v[f.name] === "" || (Array.isArray(v[f.name]) && !(v[f.name] as unknown[]).length))) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    setError(null);
    start(async () => {
      const r = await onSubmit(v);
      if (r.ok) { dirty.current = false; onClose(); } else setError(r.error);
    });
  }

  function del() {
    if (!onDelete) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    start(async () => {
      const r = await onDelete();
      if (r.ok) onClose(); else setError(r.error);
    });
  }

  const val = (n: string) => initial[n];
  return (
    <div className="scrim open" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose.current(); }}>
      <div ref={modalRef} className={`modal ${aside ? "wide" : ""} ${pending ? "busy" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mhead">
          <h2>{title}</h2>
          <button type="button" className="x" aria-label="Close" onClick={() => requestClose.current()}>×</button>
        </div>
        {error ? <div className="err" role="alert">{error}</div> : null}
        <div className="mbody">
        <div className="mmain">
        {intro}
        <form ref={formRef} className="form" onSubmit={submit} noValidate onInput={() => { dirty.current = true; }} onChange={() => { dirty.current = true; }}>
          <fieldset disabled={readOnly} style={{ display: "contents" }}>
            {fields.map((f) => {
              const id = `fld-${f.name}`;
              if (f.type === "checkbox")
                return (
                  <div className="f full" key={f.name}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" id={id} name={f.name} defaultChecked={!!val(f.name)} style={{ accentColor: "var(--accent)" }} /> {f.label}
                    </label>
                    {f.help ? <span className="help">{f.help}</span> : null}
                  </div>
                );
              let input: React.ReactNode;
              if (f.type === "textarea") input = <textarea id={id} name={f.name} defaultValue={String(val(f.name) ?? "")} placeholder={f.placeholder} />;
              else if (f.type === "select")
                input = <select id={id} name={f.name} defaultValue={String(val(f.name) ?? "")}>{f.options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>;
              else if (f.type === "multi") {
                const sel = (val(f.name) as string[] | undefined) ?? [];
                input = <div className="multi" id={id}>{f.options.map(([o, l]) => <label key={o}><input type="checkbox" name={f.name} value={o} defaultChecked={sel.includes(o)} />{l}</label>)}</div>;
              } else input = <input id={id} name={f.name} type={f.type} defaultValue={val(f.name) == null ? "" : String(val(f.name))} placeholder={f.placeholder} autoComplete={f.type === "password" ? "new-password" : undefined} />;
              return (
                <div className={`f ${f.full ? "full" : ""}`} key={f.name}>
                  <label className="l" htmlFor={id}>{f.label}</label>
                  {input}
                  {f.help ? <span className="help">{f.help}</span> : null}
                </div>
              );
            })}
          </fieldset>
          <button type="submit" hidden />
        </form>
        </div>
        {aside ? <div className="maside">{aside}</div> : null}
        </div>
        {askDiscard ? (
          <div className="mfoot">
            <span className="discard">Discard what you’ve typed?</span>
            <div className="r">
              <button className="btn" type="button" autoFocus onClick={() => setAskDiscard(false)}>Keep editing</button>
              <button className="btn danger-solid" type="button" onClick={onClose}>Discard</button>
            </div>
          </div>
        ) : (
        <div className="mfoot">
          {readOnly ? <span className="fine">View only. Ask an admin to make changes.</span> : onDelete ? <button className="btn danger" onClick={del} type="button">{confirmDel ? "Click again to confirm" : deleteLabel}</button> : null}
          {footerExtra}
          <div className="r">
            <button className="btn" type="button" onClick={() => requestClose.current()}>{readOnly ? "Close" : "Cancel"}</button>
            {!readOnly && onSubmit ? <button className="btn primary" type="button" onClick={() => formRef.current?.requestSubmit()}>{pending ? "Saving…" : submitLabel}</button> : null}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
