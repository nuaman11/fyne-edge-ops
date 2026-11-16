"use server";

import { desc, ilike, or, sql } from "drizzle-orm";
import { db, tickets, clients, deals, users } from "@/lib/db";
import { actor } from "@/lib/action";
import { CLIENT_STAGES, DEAL_STAGES, TICKET_STATUSES, label } from "@/lib/constants";
import { aed, ticketCode } from "@/lib/format";

export type SearchHit = { group: "Tickets" | "Clients" | "Leads" | "People"; title: string; sub: string; href: string };

/** One search box across tickets, clients, leads and people. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const me = await actor();
  const q = String(query ?? "").trim().slice(0, 100);
  if (!q) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const num = /^(fe-?)?(\d+)$/i.exec(q);
  const ticketNumber = num ? Number(num[2]) - (num[1] || Number(num[2]) > 100 ? 100 : 0) : null;

  const [t, c, d, u] = await Promise.all([
    db.select({ id: tickets.id, number: tickets.number, title: tickets.title, status: tickets.status }).from(tickets)
      .where(or(ilike(tickets.title, like), ilike(tickets.description, like), ticketNumber && ticketNumber > 0 ? sql`${tickets.number} = ${ticketNumber}` : undefined))
      .orderBy(desc(tickets.number)).limit(6),
    db.select({ id: clients.id, name: clients.name, stage: clients.stage, service: clients.service, contactName: clients.contactName }).from(clients)
      .where(or(ilike(clients.name, like), ilike(clients.contactName, like), ilike(clients.email, like), ilike(clients.phone, like))).limit(5),
    db.select({ id: deals.id, company: deals.company, stage: deals.stage, value: deals.value }).from(deals)
      .where(or(ilike(deals.company, like), ilike(deals.contactName, like), ilike(deals.source, like))).limit(5),
    db.select({ id: users.id, name: users.name, department: users.department, jobTitle: users.jobTitle }).from(users)
      .where(or(ilike(users.name, like), ilike(users.department, like), ilike(users.jobTitle, like))).limit(5),
  ]);

  return [
    ...t.map((x): SearchHit => ({ group: "Tickets", title: x.title, sub: `${ticketCode(x.number)} · ${label(TICKET_STATUSES, x.status)}`, href: `/tickets?open=${x.id}` })),
    ...c.map((x): SearchHit => ({ group: "Clients", title: x.name, sub: `${label(CLIENT_STAGES, x.stage)} · ${x.service}${x.contactName ? " · " + x.contactName : ""}`, href: `/clients?open=${x.id}` })),
    ...d.map((x): SearchHit => ({ group: "Leads", title: x.company, sub: `${label(DEAL_STAGES, x.stage)}${x.value ? " · " + aed(x.value) : ""}`, href: `/pipeline?open=${x.id}` })),
    ...u.map((x): SearchHit => ({
      group: "People", title: x.name, sub: `${x.jobTitle ? x.jobTitle + " · " : ""}${x.department}`,
      href: me.role === "ADMIN" ? `/users?open=${x.id}` : `/tickets?assignee=${x.id}`,
    })),
  ];
}
