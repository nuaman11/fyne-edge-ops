import { initials } from "@/lib/format";
import type { UserLite } from "@/lib/types";

export function Avatar({ user, size }: { user?: Pick<UserLite, "name"> | null; size?: "lg" }) {
  if (!user) return null;
  return <span className={`av ${size ?? ""}`} title={user.name}>{initials(user.name)}</span>;
}

export function Pill({ tone, children, title }: { tone?: "ok" | "warn" | "bad" | "acc"; children: React.ReactNode; title?: string }) {
  return <span className={`pill ${tone ?? ""}`} title={title}>{children}</span>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="top">
      <div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      <div className="toolbar">{children}</div>
    </div>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? (value / max) * 100 : 0;
  return <div className={`bar ${max && value >= max ? "full" : ""}`}><i style={{ width: `${pct}%` }} /></div>;
}
