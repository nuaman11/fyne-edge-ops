import "server-only";
import { eq } from "drizzle-orm";
import { db, tickets, ticketEvents, users, clients, type Ticket } from "@/lib/db";
import { PRIORITIES, TICKET_STATUSES, label } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { AppError } from "@/lib/action";

export type TicketChanges = Partial<{
  title: string; description: string | null; status: Ticket["status"]; priority: Ticket["priority"];
  dueDate: string | null; clientId: string | null; assigneeId: string | null;
}>;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Describes what changed on a ticket, in plain words, for the activity log. */
async function describeChanges(tx: Tx, before: Ticket, after: TicketChanges): Promise<string[]> {
  const out: string[] = [];
  if (after.status !== undefined && after.status !== before.status)
    out.push(`moved it from ${label(TICKET_STATUSES, before.status)} to ${label(TICKET_STATUSES, after.status)}`);
  if (after.assigneeId !== undefined && (after.assigneeId ?? null) !== before.assigneeId) {
    if (!after.assigneeId) out.push("unassigned it");
    else {
      const [u] = await tx.select({ name: users.name }).from(users).where(eq(users.id, after.assigneeId)).limit(1);
      out.push(`assigned it to ${u?.name ?? "someone"}`);
    }
  }
  if (after.priority !== undefined && after.priority !== before.priority) out.push(`set priority to ${label(PRIORITIES, after.priority)}`);
  if (after.dueDate !== undefined && (after.dueDate ?? null) !== before.dueDate)
    out.push(after.dueDate ? `set the due date to ${fmtDate(after.dueDate, true)}` : "removed the due date");
  if (after.clientId !== undefined && (after.clientId ?? null) !== before.clientId) {
    if (!after.clientId) out.push("made it an internal ticket");
    else {
      const [c] = await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, after.clientId)).limit(1);
      out.push(`linked it to ${c?.name ?? "a client"}`);
    }
  }
  if (after.title !== undefined && after.title !== before.title) out.push("renamed it");
  if (after.description !== undefined && (after.description ?? null) !== before.description) out.push("edited the description");
  return out;
}

/** Updates a ticket and records each change in its activity log, in one transaction. */
export async function updateTicketLogged(tx: Tx, id: string, actorId: string, changes: TicketChanges) {
  const [before] = await tx.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (!before) throw new AppError("Ticket not found. It may have been deleted.");
  const details = await describeChanges(tx, before, changes);
  if (!details.length) return;
  await tx.update(tickets).set(changes).where(eq(tickets.id, id));
  await tx.insert(ticketEvents).values(details.map((detail) => ({ ticketId: id, actorId, detail })));
}

