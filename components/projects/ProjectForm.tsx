"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteProject, saveProject } from "@/app/actions/projects";
import { PROJECT_CATEGORIES, PROJECT_CATEGORY_ONE, PROJECT_LINK_LABELS, type ProjectCategory } from "@/lib/constants";
import type { ProjectRow } from "@/lib/types";
import { toast } from "@/components/Toaster";

type Link = { key: number; label: string; url: string };
let n = 0;

/** Add or edit a finished project: its live link, any number of other links, tech used and notes. */
export function ProjectForm({ project, clients, canDelete, onClose }: {
  project: Partial<ProjectRow>; clients: { id: string; name: string }[]; canDelete: boolean; onClose: () => void;
}) {
  const isNew = !project.id;
  const [name, setName] = useState(project.name ?? "");
  const [category, setCategory] = useState<ProjectCategory>(project.category ?? "WEBSITE");
  const [clientId, setClientId] = useState(project.clientId ?? "");
  const [completedOn, setCompletedOn] = useState(project.completedOn ?? "");
  const [liveUrl, setLiveUrl] = useState(project.liveUrl ?? "");
  const [links, setLinks] = useState<Link[]>((project.links ?? []).map((l) => ({ key: n++, ...l })));
  const [tech, setTech] = useState<string[]>(project.tech ?? []);
  const [techDraft, setTechDraft] = useState("");
  const [description, setDescription] = useState(project.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [askDiscard, setAskDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useRef(false);
  const first = useRef<HTMLInputElement>(null);
  const touch = () => { dirty.current = true; };
  const close = () => (dirty.current ? setAskDiscard(true) : onClose());

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); if (dirty.current) setAskDiscard(true); else onClose(); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  function addTech(raw: string) {
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    setTech((t) => [...new Set([...t, ...parts])].slice(0, 20));
    setTechDraft(""); touch();
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) { setError("Give the project a name."); first.current?.focus(); return; }
    setError(null);
    const allTech = techDraft.trim() ? [...new Set([...tech, ...techDraft.split(",").map((t) => t.trim()).filter(Boolean)])] : tech;
    start(async () => {
      const r = await saveProject(project.id ?? null, {
        name, category, clientId: clientId || null, completedOn: completedOn || null, liveUrl: liveUrl.trim() || null,
        links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
        tech: allTech, description,
      });
      if (!r.ok) { setError(r.error); return; }
      dirty.current = false;
      toast(isNew ? "Project added." : "Project saved.");
      onClose();
    });
  }

  function remove() {
    if (!project.id) return;
    start(async () => {
      const r = await deleteProject(project.id!);
      if (!r.ok) { setError(r.error); return; }
      toast("Project deleted.");
      onClose();
    });
  }

  return (
    <div className="scrim open" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`modal ${pending ? "busy" : ""}`} role="dialog" aria-modal="true" aria-label={isNew ? "Add project" : "Edit project"}>
        <div className="mhead"><h2>{isNew ? "Add a finished project" : "Edit project"}</h2><button type="button" className="x" aria-label="Close" onClick={close}>×</button></div>
        {error ? <div className="err" role="alert">{error}</div> : null}
        <div className="mbody"><div className="mmain">
          <form className="form" onSubmit={submit} noValidate onChange={touch}>
            <div className="f full"><label className="l" htmlFor="p-name">Project name</label>
              <input ref={first} id="p-name" type="text" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="e.g. MSEC guard management portal" /></div>

            <div className="f full"><span className="l">Category</span>
              <div className="catpick" role="radiogroup" aria-label="Category">
                {PROJECT_CATEGORIES.map(([k]) => (
                  <button key={k} type="button" role="radio" aria-checked={category === k} className={category === k ? "on" : ""} onClick={() => { setCategory(k); touch(); }}>{PROJECT_CATEGORY_ONE[k]}</button>
                ))}
              </div></div>

            <div className="f"><label className="l" htmlFor="p-client">Client</label>
              <select id="p-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">None / internal</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="f"><label className="l" htmlFor="p-date">Completed on</label>
              <input id="p-date" type="date" value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} /></div>

            <div className="f full"><label className="l" htmlFor="p-live">{category === "MOBILE_APP" ? "Main link (website or store page)" : category === "AI_AUTOMATION" ? "Main link (dashboard, workflow or demo)" : "Live link"}</label>
              <input id="p-live" type="url" inputMode="url" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://" /></div>

            <div className="f full">
              <span className="l">Other links</span>
              <div className="linkrows">
                {links.map((l, i) => (
                  <div className="linkrow" key={l.key}>
                    <input type="text" list="p-link-labels" aria-label={`Link ${i + 1} name`} placeholder="Name, e.g. Admin panel" value={l.label} maxLength={60}
                      onChange={(e) => setLinks((ls) => ls.map((x) => (x.key === l.key ? { ...x, label: e.target.value } : x)))} />
                    <input type="url" inputMode="url" aria-label={`Link ${i + 1} address`} placeholder="https://" value={l.url}
                      onChange={(e) => setLinks((ls) => ls.map((x) => (x.key === l.key ? { ...x, url: e.target.value } : x)))} />
                    <button type="button" className="btn sm ghost" aria-label={`Remove link ${i + 1}`} onClick={() => { setLinks((ls) => ls.filter((x) => x.key !== l.key)); touch(); }}>×</button>
                  </div>
                ))}
                <datalist id="p-link-labels">{PROJECT_LINK_LABELS.map((x) => <option key={x} value={x} />)}</datalist>
                {links.length < 20 ? <button type="button" className="btn sm" onClick={() => { setLinks((ls) => [...ls, { key: n++, label: "", url: "" }]); touch(); }}>+ Add a link</button> : null}
              </div>
              <span className="help">Admin panels, staging, App Store / Google Play, repository, design files, documentation… Don’t paste passwords here.</span>
            </div>

            <div className="f full"><label className="l" htmlFor="p-tech">Built with</label>
              <div className="techbox">
                {tech.map((t) => <span className="chip tech" key={t}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => { setTech((x) => x.filter((y) => y !== t)); touch(); }}>×</button></span>)}
                <input id="p-tech" type="text" value={techDraft} placeholder={tech.length ? "Add more…" : "e.g. Next.js, Flutter, n8n — press Enter"}
                  onChange={(e) => { if (e.target.value.endsWith(",")) addTech(e.target.value); else setTechDraft(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addTech(techDraft); }
                    if (e.key === "Backspace" && !techDraft && tech.length) setTech((x) => x.slice(0, -1));
                  }} onBlur={() => addTech(techDraft)} />
              </div></div>

            <div className="f full"><label className="l" htmlFor="p-desc">Notes</label>
              <textarea id="p-desc" value={description} maxLength={3000} onChange={(e) => setDescription(e.target.value)} placeholder="What it does, who it’s for, anything the team should know." /></div>
            <button type="submit" hidden />
          </form>
        </div></div>
        {askDiscard ? (
          <div className="mfoot"><span className="discard">Discard what you’ve typed?</span><div className="r"><button className="btn" type="button" autoFocus onClick={() => setAskDiscard(false)}>Keep editing</button><button className="btn danger-solid" type="button" onClick={onClose}>Discard</button></div></div>
        ) : (
          <div className="mfoot">
            {!isNew && canDelete ? (confirmDelete
              ? <button type="button" className="btn danger-solid" onClick={remove}>Click again to delete</button>
              : <button type="button" className="btn ghost danger" onClick={() => { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); }}>Delete</button>) : null}
            <div className="r"><button className="btn" type="button" onClick={close}>Cancel</button><button className="btn primary" type="button" disabled={pending} onClick={() => submit()}>{pending ? "Saving…" : isNew ? "Add project" : "Save changes"}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
