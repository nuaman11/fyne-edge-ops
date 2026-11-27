import { addDays, fmtDate, initials } from "@/lib/format";
import { PRIORITIES, label } from "@/lib/constants";
import type { UserLite } from "@/lib/types";

export function Avatar({ user, size }: { user?: Pick<UserLite, "name"> | null; size?: "lg" }) {
  if (!user) return null;
  return <span className={`av ${size ?? ""}`} title={user.name}>{initials(user.name)}</span>;
}

export function Pill({ tone, children, title }: { tone?: "ok" | "warn" | "bad" | "acc"; children: React.ReactNode; title?: string }) {
  return <span className={`pill ${tone ?? ""}`} title={title}>{children}</span>;
}

export function PageHead({ title, sub, eyebrow, children }: { title: React.ReactNode; sub?: React.ReactNode; eyebrow?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="top">
      <div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      <div className="toolbar">{children}</div>
    </div>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? (value / max) * 100 : 0;
  return <div className={`bar ${max && value >= max ? "full" : ""}`}><i style={{ width: `${pct}%` }} /></div>;
}

/** Priority as 1–4 rising bars, coloured by urgency. */
export function PrioGlyph({ priority }: { priority: string }) {
  const p = (priority || "LOW").toLowerCase();
  const n = ({ low: 1, medium: 2, high: 3, urgent: 4 } as Record<string, number>)[p] ?? 1;
  return (
    <span className={`pg pg-${p}`} title={`${label(PRIORITIES, priority)} priority`} aria-label={`${label(PRIORITIES, priority)} priority`}>
      {[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? "on" : ""} style={{ height: 2 + i * 2.5 }} />)}
    </span>
  );
}

/** Due date tag: red when overdue, amber when due within 2 days. */
export function DueChip({ due, done, today }: { due: string | null; done?: boolean; today: string }) {
  if (!due) return null;
  const late = !done && due < today;
  const soon = !late && !done && due <= addDays(today, 2);
  return <span className={`due ${late ? "late" : soon ? "soon" : ""}`}>{late ? "Overdue · " : ""}{fmtDate(due)}</span>;
}

export function EmptyState({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="es">
      <div className="es-t">{title}</div>
      <p>{children}</p>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  ticket: <><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M15 7v2M15 11v2M15 15v2" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  funnel: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  brief: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  hire: <><circle cx="11" cy="8" r="4" /><path d="M3.5 21a7.5 7.5 0 0 1 10.5-6.9" /><path d="M15.5 18.5l2 2 4-4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><path d="M14 17.25h6.5M17.25 14v6.5" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></>,
  ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  doc: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 17c1.5-2 2.5-2 3.5 0s2 2 3.5 0" /></>,
};
export function Icon({ name }: { name: keyof typeof ICONS | string }) {
  return <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;
}
