import "server-only";
import { asc, count, desc } from "drizzle-orm";
import { db, users, tickets, clients, clientDevelopers, deals, hiringRequests, hiringApprovals, ticketComments, projects } from "@/lib/db";
import type { ClientRow, DealRow, HiringRow, ProjectRow, TicketRow, UserLite } from "@/lib/types";

export async function listUsers(): Promise<UserLite[]> {
  return db.select({
    id: users.id, name: users.name, role: users.role, department: users.department,
    jobTitle: users.jobTitle, isDeptHead: users.isDeptHead, active: users.active,
  }).from(users).orderBy(asc(users.name));
}

export async function listTickets(): Promise<TicketRow[]> {
  const [rows, counts] = await Promise.all([
    db.select({
      id: tickets.id, number: tickets.number, title: tickets.title, description: tickets.description, status: tickets.status,
      priority: tickets.priority, dueDate: tickets.dueDate, clientId: tickets.clientId, assigneeId: tickets.assigneeId, createdById: tickets.createdById,
    }).from(tickets).orderBy(desc(tickets.number)),
    db.select({ ticketId: ticketComments.ticketId, n: count() }).from(ticketComments).groupBy(ticketComments.ticketId),
  ]);
  const byTicket = new Map(counts.map((c) => [c.ticketId, c.n]));
  return rows.map((t) => ({ ...t, commentCount: byTicket.get(t.id) ?? 0 }));
}

export async function listClients(): Promise<ClientRow[]> {
  const [rows, devs] = await Promise.all([
    db.select().from(clients).orderBy(desc(clients.createdAt)),
    db.select().from(clientDevelopers),
  ]);
  return rows.map((c) => ({
    id: c.id, name: c.name, contactName: c.contactName, phone: c.phone, email: c.email, service: c.service, value: c.value,
    stage: c.stage, startDate: c.startDate, closedAt: c.closedAt, notes: c.notes, onboarding: c.onboarding ?? {}, closing: c.closing ?? {},
    leadId: c.leadId, developerIds: devs.filter((d) => d.clientId === c.id).map((d) => d.userId),
  }));
}

export async function listDeals(): Promise<DealRow[]> {
  return db.select({
    id: deals.id, company: deals.company, contactName: deals.contactName, service: deals.service, value: deals.value, stage: deals.stage,
    expectedClose: deals.expectedClose, source: deals.source, nextAction: deals.nextAction, notes: deals.notes, clientId: deals.clientId,
    lostReason: deals.lostReason, lostNote: deals.lostNote,
  }).from(deals).orderBy(desc(deals.createdAt));
}

export async function listHiring(): Promise<HiringRow[]> {
  const [reqs, apps] = await Promise.all([
    db.select().from(hiringRequests).orderBy(desc(hiringRequests.createdAt)),
    db.select().from(hiringApprovals),
  ]);
  return reqs.map((r) => ({
    id: r.id, candidate: r.candidate, position: r.position, department: r.department, startDate: r.startDate, notes: r.notes,
    requiredDepartments: r.requiredDepartments, createdAt: r.createdAt.toISOString(),
    approvals: apps.filter((a) => a.requestId === r.id).map((a) => ({
      department: a.department, decision: a.decision, decidedById: a.decidedById, decidedAt: a.decidedAt.toISOString(),
    })),
  }));
}

export async function hasAnyUser() {
  const [{ n }] = await db.select({ n: count() }).from(users);
  return n > 0;
}

export async function listProjects(): Promise<ProjectRow[]> {
  const rows = await db.select().from(projects).orderBy(desc(projects.completedOn), desc(projects.createdAt));
  return rows.map((p) => ({
    id: p.id, name: p.name, category: p.category, clientId: p.clientId, liveUrl: p.liveUrl, links: p.links ?? [],
    description: p.description, tech: p.tech ?? [], completedOn: p.completedOn, createdById: p.createdById, updatedAt: p.updatedAt.toISOString(),
  }));
}
