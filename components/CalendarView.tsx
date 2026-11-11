"use client";

import { useState } from "react";
import Link from "next/link";
import { ticketCode, todayISO } from "@/lib/format";
import { PageHead } from "@/components/ui";

type T = { id: string; title: string; number: number; dueDate: string; priority: string; status: string };
type K = { id: string; name: string; date: string };
type D = { id: string; company: string; date: string };

function iso(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export function CalendarView({ tickets, kickoffs, closes }: { tickets: T[]; kickoffs: K[]; closes: D[] }) {
  const today = todayISO();
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }));
  const [show, setShow] = useState({ tickets: true, clients: true, deals: true });

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: 42 }, (_, i) => iso(ym.y, ym.m, 1 - startDow + i));
  const lastRow = new Date(cells[35]! + "T00:00:00Z").getUTCMonth() !== ym.m ? 35 : 42;
  const monthName = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const nav = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <>
      <PageHead title="Calendar" sub="Ticket due dates, client kickoffs and expected deal closes. Click a day to add a ticket.">
        <button className="btn" onClick={() => nav(-1)} aria-label="Previous month">‹</button>
        <button className="btn" onClick={() => setYm({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 })}>Today</button>
        <button className="btn" onClick={() => nav(1)} aria-label="Next month">›</button>
        <Link className="btn primary" href="/tickets?new=1">+ New ticket</Link>
      </PageHead>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 18 }}>{monthName}</h2>
        <div className="legend">
          <label><input type="checkbox" checked={show.tickets} onChange={(e) => setShow({ ...show, tickets: e.target.checked })} /> <span className="ev">Tickets</span></label>
          <label><input type="checkbox" checked={show.clients} onChange={(e) => setShow({ ...show, clients: e.target.checked })} /> <span className="ev client">Client kickoffs</span></label>
          <label><input type="checkbox" checked={show.deals} onChange={(e) => setShow({ ...show, deals: e.target.checked })} /> <span className="ev deal">Expected closes</span></label>
        </div>
      </div>
      <div className="cal">
        <div className="dow">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div>
        <div className="days">
          {cells.slice(0, lastRow).map((ds) => {
            const d = new Date(ds + "T00:00:00Z");
            const out = d.getUTCMonth() !== ym.m;
            const wk = d.getUTCDay() === 0 || d.getUTCDay() === 6;
            return (
              <div key={ds} className={`day ${out ? "out" : ""} ${wk && !out ? "wk" : ""} ${ds === today ? "today" : ""}`}
                onClick={(e) => { if (e.target === e.currentTarget) window.location.href = `/tickets?new=1&due=${ds}`; }}>
                <span className="dn">{d.getUTCDate()}</span>
                {show.tickets && tickets.filter((t) => t.dueDate === ds).map((t) => (
                  <Link key={t.id} href={`/tickets?open=${t.id}`} className={`ev ${t.priority.toLowerCase()} ${t.status === "DONE" ? "done" : ""}`} title={`${ticketCode(t.number)} ${t.title}`}>{t.title}</Link>
                ))}
                {show.clients && kickoffs.filter((k) => k.date === ds).map((k) => <Link key={k.id} href="/clients" className="ev client">Kickoff · {k.name}</Link>)}
                {show.deals && closes.filter((c) => c.date === ds).map((c) => <Link key={c.id} href="/pipeline" className="ev deal">Close · {c.company}</Link>)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
