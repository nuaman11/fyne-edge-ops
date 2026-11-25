"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { createDocument } from "@/app/actions/documents";
import type { StorageMode } from "@/lib/storage";

const MAX = 25 * 1024 * 1024;

/** Step 1: pick a PDF and give it a title. Step 2 (the editor) is where signers and boxes are added. */
export function NewDocumentForm({ meId, mode, clients }: { meId: string; mode: StorageMode; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function choose(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) { setError("Choose a PDF file."); return; }
    if (f.size > MAX) { setError("The PDF is larger than 25 MB. Compress it or split it, then try again."); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Choose a PDF file."); return; }
    if (!title.trim()) { setError("Give the document a title."); return; }
    setError(null);
    start(async () => {
      try {
        setProgress(0);
        let path: string;
        if (mode === "blob") {
          const safe = file.name.replace(/\.pdf$/i, "").replace(/[^\w\-]+/g, "-").slice(0, 60) || "document";
          const r = await upload(`documents/${meId}/${safe}.pdf`, file, {
            access: "private", handleUploadUrl: "/api/documents/upload", contentType: "application/pdf",
            onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
          });
          path = r.pathname;
        } else {
          const fd = new FormData(); fd.append("file", file);
          const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || "Upload failed.");
          path = j.pathname;
        }
        setProgress(100);
        const r = await createDocument({ title, path, fileName: file.name, clientId: clientId || null });
        if (!r.ok) { setError(r.error); setProgress(null); return; }
        router.push(`/documents/${r.id}/edit`);
      } catch (err) {
        setProgress(null);
        setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      }
    });
  }

  if (mode === "missing") return (
    <div className="notice"><span>File storage isn’t connected yet. In Vercel, open the project → <b>Storage</b> → <b>Create</b> → <b>Blob</b>, connect it to this project, then redeploy.</span></div>
  );

  return (
    <form className="panel newdoc" onSubmit={submit} noValidate>
      <div className={`drop ${over ? "over" : ""} ${file ? "has" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}>
        <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => choose(e.target.files?.[0])} />
        {file ? <><b>{file.name}</b><span>{(file.size / 1024 / 1024).toFixed(1)} MB · click to choose a different file</span></>
          : <><b>Drop a PDF here, or click to choose one</b><span>Contracts, NDAs, offer letters… up to 25 MB</span></>}
      </div>
      <div className="form">
        <div className="f full"><label className="l" htmlFor="nd-title">Title</label><input id="nd-title" type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. MSEC Security – Service agreement" /></div>
        <div className="f full"><label className="l" htmlFor="nd-client">Client (optional)</label>
          <select id="nd-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
      {progress !== null ? <div className="bar" aria-label="Upload progress"><i style={{ width: `${progress}%` }} /></div> : null}
      <div className="doc-actions">
        <button type="submit" className="btn primary" disabled={pending || !file}>{pending ? (progress !== null && progress < 100 ? `Uploading… ${progress}%` : "Preparing…") : "Upload and continue"}</button>
      </div>
    </form>
  );
}
