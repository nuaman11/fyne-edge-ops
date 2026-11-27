"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PROJECT_CATEGORIES, PROJECT_CATEGORY_ONE, type ProjectCategory } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { ProjectRow } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { EmptyState, Icon, PageHead } from "@/components/ui";
import { ProjectForm } from "@/components/projects/ProjectForm";

const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };
const shortUrl = (u: string) => { try { const x = new URL(u); return (x.host.replace(/^www\./, "") + (x.pathname === "/" ? "" : x.pathname)).replace(/\/$/, ""); } catch { return u; } };

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast("Link copied."); } catch { toast("Couldn’t copy. Long-press the link instead."); }
}

function Favicon({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  if (!url || failed) return <span className="pfav letters" aria-hidden="true">{letters || "•"}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pfav" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(url))}&sz=64`} alt="" onError={() => setFailed(true)} loading="lazy" />;
}

function LinkRow({ label, url, primary }: { label: string; url: string; primary?: boolean }) {
  return (
    <div className={`plink ${primary ? "primary" : ""}`}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="plink-main" title={url}>
        <span className="plink-l">{label}</span>
        <span className="plink-u">{shortUrl(url)}</span>
        <Icon name="ext" />
      </a>
      <button type="button" className="plink-copy" aria-label={`Copy ${label} link`} onClick={() => copy(url)}><Icon name="copy" /></button>
    </div>
  );
}

/** Every finished project in one place, with its links, by category. */
export function ProjectsView({ projects, clients, me, initial }: {
  projects: ProjectRow[]; clients: { id: string; name: string }[];
  me: { id: string; role: "ADMIN" | "USER" };
  initial: { openId?: string; newProject?: boolean; category?: string; clientId?: string };
}) {
  const router = useRouter();
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const [cat, setCat] = useState<ProjectCategory | "">(PROJECT_CATEGORIES.some(([k]) => k === initial.category) ? (initial.category as ProjectCategory) : "");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<ProjectRow> | null>(() => {
    if (!initial.newProject) return null;
    const c = initial.clientId ? clients.find((x) => x.id === initial.clientId) : undefined;
    return c ? { clientId: c.id, name: c.name, category: "WEBSITE" } : { category: "WEBSITE" };
  });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!initial.openId) return;
    const el = document.getElementById(`project-${initial.openId}`);
    el?.scrollIntoView({ block: "center" });
    setFlash(initial.openId);
    const t = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(t);
  }, [initial.openId]);

  const ql = q.trim().toLowerCase();
  const matchesQ = (p: ProjectRow) => !ql || [p.name, p.liveUrl, p.description, p.clientId ? clientName.get(p.clientId) : "", ...p.tech, ...p.links.flatMap((l) => [l.label, l.url])]
    .some((x) => (x ?? "").toLowerCase().includes(ql));
  const base = projects.filter(matchesQ);
  const list = base.filter((p) => !cat || p.category === cat);
  const count = (k: ProjectCategory | "") => base.filter((p) => !k || p.category === k).length;

  function closeForm() {
    setEditing(null);
    if (initial.newProject) router.replace("/projects");
    router.refresh();
  }

  return (
    <>
      <PageHead title="Projects" sub="Everything we’ve delivered, with every link in one place.">
        <button className="btn primary" onClick={() => setEditing({ category: cat || "WEBSITE" })}>+ Add project</button>
      </PageHead>

      {projects.length ? (
        <div className="filters">
          <div className="quick">
            <button className={!cat ? "on" : ""} onClick={() => setCat("")}>All<span className="c">{count("")}</span></button>
            {PROJECT_CATEGORIES.map(([k, l]) => (
              <button key={k} className={cat === k ? "on" : ""} onClick={() => setCat(cat === k ? "" : k)}>{l}<span className="c">{count(k)}</span></button>
            ))}
          </div>
          <div className="toolbar">
            <input type="search" aria-label="Filter projects" placeholder="Filter by name, client, link or tech" value={q} onChange={(e) => setQ(e.target.value)} className="pfilter" />
          </div>
        </div>
      ) : null}

      {!projects.length ? (
        <EmptyState title="No projects yet" actions={<button className="btn primary" onClick={() => setEditing({ category: "WEBSITE" })}>+ Add your first project</button>}>
          Add the websites, web apps, mobile apps and AI automations you’ve delivered, with their live links, admin panels, store pages and anything else the team needs to find quickly.
        </EmptyState>
      ) : !list.length ? (
        <EmptyState title="Nothing matches" actions={<button className="btn" onClick={() => { setQ(""); setCat(""); }}>Show all projects</button>}>
          Try another category, or clear the filter.
        </EmptyState>
      ) : (
        <div className="pgrid">
          {list.map((p) => (
            <article className={`pcard ${flash === p.id ? "flash" : ""}`} key={p.id} id={`project-${p.id}`}>
              <div className="pcard-hd">
                <Favicon url={p.liveUrl} name={p.name} />
                <div className="grow">
                  <h3>{p.name}</h3>
                  <div className="pmeta">
                    <span className={`pcat cat-${p.category.toLowerCase()}`}>{PROJECT_CATEGORY_ONE[p.category]}</span>
                    {p.clientId && clientName.get(p.clientId) ? <span>{clientName.get(p.clientId)}</span> : null}
                    {p.completedOn ? <span className="mono">{fmtDate(p.completedOn, true)}</span> : null}
                  </div>
                </div>
                <button type="button" className="btn sm ghost" onClick={() => setEditing(p)}>Edit</button>
              </div>
              {p.description ? <p className="pdesc">{p.description}</p> : null}
              {p.liveUrl || p.links.length ? (
                <div className="plinks">
                  {p.liveUrl ? <LinkRow label={p.category === "WEBSITE" || p.category === "WEB_APP" ? "Live" : "Main"} url={p.liveUrl} primary /> : null}
                  {p.links.map((l, i) => <LinkRow key={i} label={l.label} url={l.url} />)}
                </div>
              ) : <div className="empty" style={{ padding: 0 }}>No links yet. <button className="link" onClick={() => setEditing(p)}>Add one</button></div>}
              {p.tech.length ? <div className="ptech">{p.tech.map((t) => <span key={t} className="chip tech">{t}</span>)}</div> : null}
            </article>
          ))}
        </div>
      )}

      {editing ? (
        <ProjectForm project={editing} clients={clients} onClose={closeForm}
          canDelete={me.role === "ADMIN" || (!!editing.createdById && editing.createdById === me.id)} />
      ) : null}
    </>
  );
}
