import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listClients, listDeals, listHiring, listTickets, listUsers } from "@/lib/queries";
import { CLIENT_STAGES, DEAL_STAGES, TICKET_STATUSES, label } from "@/lib/constants";
import { addDays, aed, plural, ticketCode, todayISO, TZ } from "@/lib/format";
import { canApproveDept, hiringStatus } from "@/lib/types";
import { Avatar, DueChip, EmptyState, PageHead, Pill, PrioGlyph } from "@/components/ui";
import { SetupChecklist, type SetupStep } from "@/components/SetupChecklist";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const me = await requireUser();
  const [tickets, clients, deals, hiring, users] = await Promise.all([listTickets(), listClients(), listDeals(), listHiring(), listUsers()]);
  const today = todayISO();
  const week = addDays(today, 7);
  const userById = new Map(users.map((u) => [u.id, u]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const byDue = (a: { dueDate: string | null }, b: { dueDate: string | null }) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9");

  const open = tickets.filter((t) => t.status !== "DONE");
  const late = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueWeek = open.filter((t) => t.dueDate && t.dueDate <= week);
  const soon = dueWeek.slice().sort(byDue).slice(0, 8);
  const pending = hiring.filter((h) => hiringStatus(h) === "pending");
  const openDeals = deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST");
  const pipeVal = openDeals.reduce((a, d) => a + d.value, 0);

  // My work
  const mineT = open.filter((t) => t.assigneeId === me.id).sort(byDue);
  const mineLate = mineT.filter((t) => t.dueDate && t.dueDate < today).length;
  const myHires = pending.filter((h) => h.requiredDepartments.some((d) => !h.approvals.some((a) => a.department === d) && canApproveDept(me, d)));
  const myClients = clients.filter((c) => c.stage !== "CLOSED" && (c.developerIds.includes(me.id) || c.leadId === me.id));
  const createdOpen = open.filter((t) => t.createdById === me.id && t.assigneeId !== me.id).length;
  const showApprovals = me.role !== "ADMIN" ? me.isDeptHead : myHires.length > 0;

  const bits = [plural(mineT.length, "open ticket") + " assigned to you"];
  if (mineLate) bits.push(`${mineLate} overdue`);
  if (myHires.length) bits.push(plural(myHires.length, "hiring request") + " waiting on your sign-off");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
  const hi = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });

  const stageVals = DEAL_STAGES.filter(([k]) => k !== "LOST").map(([k, l]) => {
    const ds = deals.filter((d) => d.stage === k);
    return { k, l, n: ds.length, v: ds.reduce((a, d) => a + d.value, 0) };
  });
  const maxV = Math.max(1, ...stageVals.map((s) => s.v));
  const devs = users.filter((u) => u.active && (u.department === "Engineering" || u.department === "Design"));

  const setup: SetupStep[] = [
    { title: "Add your team", text: "Create accounts for the people you assign tickets, clients and approvals to.", done: users.length > 1, href: "/users", action: "Add users" },
    { title: "Mark department heads", text: "Heads sign off hires for their department.", done: users.some((u) => u.isDeptHead), href: "/users", action: "Open Users" },
    { title: "Create your first client", text: "Or win a lead in the Pipeline and convert it.", done: clients.length > 0, href: "/clients?new=1", action: "New client" },
    { title: "Add a lead to the pipeline", text: "Track deals from first contact to signed.", done: deals.length > 0, href: "/pipeline?new=1", action: "New lead" },
  ];

  return (
    <>
      <div className="greet">
        <PageHead title={`${hi}, ${me.name.split(" ")[0]}`} eyebrow={dateLine} sub={bits.join(", ") + "."}>
          <Link className="btn primary" href="/tickets?new=1">+ New ticket</Link>
        </PageHead>
      </div>

      {me.role === "ADMIN" ? <SetupChecklist steps={setup} /> : null}

      <div className="stats">
        <Link className="stat" href="/tickets?filter=open"><div className="k">Open tickets<i>View →</i></div><div className="v">{open.length}</div><div className="d">{dueWeek.length} due this week</div></Link>
        <Link className={`stat ${late.length ? "alert" : ""}`} href="/tickets?filter=overdue"><div className="k">Overdue tickets<i>View →</i></div><div className="v">{late.length}</div><div className="d">{late.length ? "past their due date" : "all on time"}</div></Link>
        <Link className="stat" href="/clients?tab=ONBOARDING"><div className="k">Clients onboarding<i>View →</i></div><div className="v">{clients.filter((c) => c.stage === "ONBOARDING").length}</div><div className="d">{clients.filter((c) => c.stage === "ACTIVE").length} active</div></Link>
        <Link className="stat" href="/hiring?tab=pending"><div className="k">Hires awaiting approval<i>View →</i></div><div className="v">{pending.length}</div><div className="d">{myHires.length} need you</div></Link>
        <Link className="stat" href="/pipeline"><div className="k">Open pipeline<i>View →</i></div><div className="v">{pipeVal.toLocaleString("en-US")}</div><div className="d">AED · {plural(openDeals.length, "deal")}</div></Link>
      </div>

      <div className="ov">
        <section className="panel">
          <div className="ph"><h2>My work</h2><Link className="link" href="/tickets?filter=mine">All my tickets →</Link></div>
          <div className="sh"><span>Assigned to me</span><span>{mineT.length}</span></div>
          <div className="rows">
            {mineT.length ? mineT.slice(0, 6).map((t) => (
              <Link className="row" key={t.id} href={`/tickets?open=${t.id}`}>
                <PrioGlyph priority={t.priority} /><span className="code">{ticketCode(t.number)}</span>
                <div className="grow"><div className="t">{t.title}</div><div className="s">{t.clientId ? clientById.get(t.clientId)?.name : "Internal"} · {label(TICKET_STATUSES, t.status)}</div></div>
                <DueChip due={t.dueDate} today={today} />
              </Link>
            )) : <div className="empty">No open tickets assigned to you.</div>}
          </div>
          {showApprovals ? <>
            <div className="sh"><span>Waiting on my sign-off</span><span>{myHires.length}</span></div>
            <div className="rows">
              {myHires.length ? myHires.slice(0, 5).map((h) => {
                const depts = h.requiredDepartments.filter((d) => !h.approvals.some((a) => a.department === d) && canApproveDept(me, d));
                return (
                  <Link className="row" key={h.id} href="/hiring?tab=pending">
                    <div className="grow"><div className="t">{h.candidate} · {h.position}</div><div className="s">Sign off for {depts.join(", ")}</div></div>
                    <Pill tone="warn">Review</Pill>
                  </Link>
                );
              }) : <div className="empty">No hiring requests need your sign-off.</div>}
            </div>
          </> : null}
          <div className="sh"><span>My clients</span><span>{myClients.length}</span></div>
          <div className="rows">
            {myClients.length ? myClients.slice(0, 5).map((c) => (
              <Link className="row" key={c.id} href={`/clients?tab=${c.stage}`}>
                <div className="grow"><div className="t">{c.name}</div><div className="s">{c.service} · {c.leadId === me.id ? "You lead this project" : "Developer"}</div></div>
                <Pill tone={c.stage === "ONBOARDING" ? "acc" : c.stage === "CLOSING" ? "warn" : undefined}>{label(CLIENT_STAGES, c.stage)}</Pill>
              </Link>
            )) : <div className="empty">You’re not on any active client yet.</div>}
          </div>
          {createdOpen ? <p className="fine" style={{ margin: "12px 0 0" }}>You opened {plural(createdOpen, "other ticket")} that {createdOpen === 1 ? "is" : "are"} still open. <Link className="link" href="/tickets?filter=created">See them</Link></p> : null}
        </section>

        <section className="panel">
          <div className="ph"><h2>Team · due in 7 days</h2><Link className="link" href="/calendar">Calendar →</Link></div>
          <div className="rows">
            {soon.length ? soon.map((t) => (
              <Link className="row" key={t.id} href={`/tickets?open=${t.id}`}>
                <div className="grow"><div className="t">{t.title}</div><div className="s"><span className="code">{ticketCode(t.number)}</span> · {t.clientId ? clientById.get(t.clientId)?.name : "Internal"}</div></div>
                <DueChip due={t.dueDate} today={today} />
                <Avatar user={t.assigneeId ? userById.get(t.assigneeId) : null} />
              </Link>
            )) : <div className="empty">{tickets.length ? "Nothing due this week." : "Tickets with due dates show up here."}</div>}
          </div>
        </section>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="ph"><h2>Pipeline by stage</h2><Link className="link" href="/pipeline">Pipeline →</Link></div>
          {deals.length ? stageVals.map((s) => (
            <div className="pbar" key={s.k}>
              <span>{s.l} <span className="code">{s.n}</span></span>
              <div className={`bar ${s.k === "WON" ? "full" : ""}`}><i style={{ width: `${(s.v / maxV) * 100}%` }} /></div>
              <span className="v">{aed(s.v)}</span>
            </div>
          )) : <div className="empty">Add leads on the Pipeline page to see deal value by stage.</div>}
        </section>
        <section className="panel">
          <div className="ph"><h2>Developer workload</h2></div>
          <div className="rows">
            {devs.length ? devs.map((u) => {
              const tk = open.filter((t) => t.assigneeId === u.id).length;
              const cl = clients.filter((c) => c.stage !== "CLOSED" && c.developerIds.includes(u.id)).length;
              return (
                <Link className="row" key={u.id} href={`/tickets?assignee=${u.id}`}>
                  <Avatar user={u} />
                  <div className="grow"><div className="t">{u.name}</div><div className="s">{u.jobTitle || u.department}</div></div>
                  <Pill>{plural(tk, "ticket")}</Pill><Pill tone="acc">{plural(cl, "client")}</Pill>
                </Link>
              );
            }) : <EmptyState title="No developers yet" actions={me.role === "ADMIN" ? <Link className="btn" href="/users">Add users</Link> : undefined}>
              People in the Engineering or Design department show up here with their open tickets and clients.
            </EmptyState>}
          </div>
        </section>
      </div>
    </>
  );
}
