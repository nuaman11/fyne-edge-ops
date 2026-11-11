import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listClients, listDeals, listHiring, listTickets, listUsers } from "@/lib/queries";
import { DEAL_STAGES, PRIORITIES, label } from "@/lib/constants";
import { addDays, aed, fmtDate, ticketCode, todayISO, TZ } from "@/lib/format";
import { hiringStatus } from "@/lib/types";
import { Avatar, PageHead, Pill } from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const me = await requireUser();
  const [tickets, clients, deals, hiring, users] = await Promise.all([listTickets(), listClients(), listDeals(), listHiring(), listUsers()]);
  const today = todayISO();
  const userById = new Map(users.map((u) => [u.id, u]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const open = tickets.filter((t) => t.status !== "DONE");
  const late = open.filter((t) => t.dueDate && t.dueDate < today);
  const soon = open.filter((t) => t.dueDate && t.dueDate <= addDays(today, 7)).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 8);
  const mine = open.filter((t) => t.assigneeId === me.id).length;
  const pending = hiring.filter((h) => hiringStatus(h) === "pending");
  const openDeals = deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST");
  const pipeVal = openDeals.reduce((a, d) => a + d.value, 0);
  const stageVals = DEAL_STAGES.filter(([k]) => k !== "LOST").map(([k, l]) => {
    const ds = deals.filter((d) => d.stage === k);
    return { k, l, n: ds.length, v: ds.reduce((a, d) => a + d.value, 0) };
  });
  const maxV = Math.max(1, ...stageVals.map((s) => s.v));
  const devs = users.filter((u) => u.active && (u.department === "Engineering" || u.department === "Design"));
  const dateLine = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });

  return (
    <>
      <PageHead title={`Hello, ${me.name.split(" ")[0]}`} sub={dateLine}>
        <Link className="btn primary" href="/tickets?new=1">+ New ticket</Link>
      </PageHead>
      <div className="tiles">
        <Link className="tile" href="/tickets"><div className="k">Open tickets</div><div className="v">{open.length}</div></Link>
        <Link className="tile" href="/tickets?mine=1"><div className="k">Assigned to me</div><div className="v">{mine}</div></Link>
        <Link className="tile" href="/tickets"><div className="k">Overdue</div><div className={`v ${late.length ? "bad" : ""}`}>{late.length}</div></Link>
        <Link className="tile" href="/clients"><div className="k">Clients onboarding</div><div className="v">{clients.filter((c) => c.stage === "ONBOARDING").length}</div></Link>
        <Link className="tile" href="/hiring"><div className="k">Hires awaiting approval</div><div className="v">{pending.length}</div></Link>
        <Link className="tile" href="/pipeline"><div className="k">Open pipeline</div><div className="v">{aed(pipeVal)}</div></Link>
      </div>
      <div className="grid2">
        <section className="panel">
          <h2>Due in the next 7 days <Link className="btn sm ghost" href="/calendar">Calendar</Link></h2>
          <div className="rows">
            {soon.length ? soon.map((t) => (
              <Link className="row" key={t.id} href={`/tickets?open=${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                <span className="code">{ticketCode(t.number)}</span>
                <div className="grow"><div className="t">{t.title}</div><div className="s">{t.clientId ? clientById.get(t.clientId)?.name : "Internal"} · {label(PRIORITIES, t.priority)}</div></div>
                <span className={t.dueDate! < today ? "late" : ""}>{fmtDate(t.dueDate)}</span>
                <Avatar user={t.assigneeId ? userById.get(t.assigneeId) : null} />
              </Link>
            )) : <div className="empty">Nothing due this week.</div>}
          </div>
        </section>
        <section className="panel">
          <h2>Hires awaiting approval <Link className="btn sm ghost" href="/hiring">Open</Link></h2>
          <div className="rows">
            {pending.length ? pending.map((h) => {
              const decided = new Set(h.approvals.map((a) => a.department));
              const waiting = h.requiredDepartments.filter((d) => !decided.has(d));
              return (
                <Link className="row" key={h.id} href="/hiring" style={{ color: "inherit", textDecoration: "none" }}>
                  <div className="grow"><div className="t">{h.candidate} · {h.position}</div><div className="s">{h.department} · waiting on {waiting.join(", ")}</div></div>
                  <Pill tone="warn">{h.requiredDepartments.length - waiting.length}/{h.requiredDepartments.length}</Pill>
                </Link>
              );
            }) : <div className="empty">No hiring requests are waiting.</div>}
          </div>
        </section>
        <section className="panel">
          <h2>Pipeline by stage <Link className="btn sm ghost" href="/pipeline">Open</Link></h2>
          {stageVals.map((s) => (
            <div className="pbar" key={s.k}>
              <span>{s.l} <span className="code">{s.n}</span></span>
              <div className={`bar ${s.k === "WON" ? "full" : ""}`}><i style={{ width: `${(s.v / maxV) * 100}%` }} /></div>
              <span className="v">{aed(s.v)}</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Developer workload</h2>
          <div className="rows">
            {devs.length ? devs.map((u) => {
              const tk = open.filter((t) => t.assigneeId === u.id).length;
              const cl = clients.filter((c) => c.stage !== "CLOSED" && c.developerIds.includes(u.id)).length;
              return (
                <div className="row" key={u.id} style={{ cursor: "default" }}>
                  <Avatar user={u} />
                  <div className="grow"><div className="t">{u.name}</div><div className="s">{u.jobTitle || u.department}</div></div>
                  <Pill>{tk} ticket{tk === 1 ? "" : "s"}</Pill><Pill tone="acc">{cl} client{cl === 1 ? "" : "s"}</Pill>
                </div>
              );
            }) : <div className="empty">{me.role === "ADMIN" ? <>Add developers on the <Link href="/users">Users</Link> page.</> : "No developers yet."}</div>}
          </div>
        </section>
      </div>
    </>
  );
}
