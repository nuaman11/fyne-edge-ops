"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, tickets, ticketComments, ticketEvents } from "@/lib/db";
import { updateTicketLogged } from "@/lib/ticket-log";
import type { TicketThread } from "@/lib/types";
import { actor, adminActor, AppError, run, reqStr, optStr, optDate, optId, type ActionResult } from "@/lib/action";

const statuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const schema = z.object({
  title: reqStr("Title", 200),
  description: optStr(5000),
  status: z.enum(statuses).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: optDate,
  clientId: optId,
  assigneeId: optId,
});
/** Any signed-in user can create and edit tickets. Ticket numbers come from a database sequence, so they never repeat. */
export async function saveTicket(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const v = schema.parse(input);
    if (id) {
      const ticketId = id;
      await db.transaction((tx) => updateTicketLogged(tx, ticketId, me.id, v));
    } else {
      id = await db.transaction(async (tx) => {
        const [r] = await tx.insert(tickets).values({ ...v, createdById: me.id }).returning({ id: tickets.id });
        await tx.insert(ticketEvents).values({ ticketId: r!.id, actorId: me.id, detail: "created this ticket" });
        return r!.id;
      });
    }
    revalidatePath("/", "layout");
    return { ok: true, id };
  });
}

export async function setTicketStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const s = z.enum(statuses).parse(status);
    await db.transaction((tx) => updateTicketLogged(tx, id, me.id, { status: s }));
    revalidatePath("/", "layout");
  });
}

export async function deleteTicket(id: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    await db.delete(tickets).where(eq(tickets.id, id));
    revalidatePath("/", "layout");
  });
}

/** Comments and activity for one ticket. */
export async function getTicketThread(id: string): Promise<TicketThread | null> {
  await actor();
  const [t] = await db.select({ createdAt: tickets.createdAt, createdById: tickets.createdById }).from(tickets).where(eq(tickets.id, id)).limit(1);
  if (!t) return null;
  const [comments, events] = await Promise.all([
    db.select().from(ticketComments).where(eq(ticketComments.ticketId, id)).orderBy(asc(ticketComments.createdAt)),
    db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, id)).orderBy(asc(ticketEvents.createdAt)),
  ]);
  return {
    createdAt: t.createdAt.toISOString(),
    createdById: t.createdById,
    comments: comments.map((c) => ({ id: c.id, authorId: c.authorId, body: c.body, createdAt: c.createdAt.toISOString() })),
    events: events.map((e) => ({ id: e.id, actorId: e.actorId, detail: e.detail, createdAt: e.createdAt.toISOString() })),
  };
}

/** Any signed-in user can comment on a ticket. */
export async function addTicketComment(ticketId: string, body: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const text = reqStr("Comment", 5000).parse(body);
    const [t] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    if (!t) throw new AppError("Ticket not found. It may have been deleted.");
    await db.insert(ticketComments).values({ ticketId, authorId: me.id, body: text });
    revalidatePath("/tickets");
  });
}
