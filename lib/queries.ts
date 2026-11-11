import "server-only";
import { asc, count, desc } from "drizzle-orm";
import { db, users, tickets, clients, clientDevelopers, deals, hiringRequests, hiringApprovals } from "@/lib/db";
import type { ClientRow, DealRow, HiringRow, TicketRow, UserLite } from "@/lib/types";

export async function listUsers(): Promise<UserLite[]> {
  return db.select({
    id: users.id, name: users.name, role: users.role, department: users.department,
    jobTitle: users.jobTitle, isDeptHead: users.isDeptHead, active: users.active,
  }).from(users).orderBy(asc(users.name));
}

export async function listTickets(): Promise<TicketRow[]> {
  return db.select({
    id: tickets.id, number: tickets.number, title: tickets.title, description: tickets.description, status: tickets.status,
    priority: tickets.priority, dueDate: tickets.dueDate, clientId: tickets.clientId, assigneeId: tickets.assigneeId, createdById: tickets.createdById,
  }).from(tickets).orderBy(desc(tickets.number));
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
