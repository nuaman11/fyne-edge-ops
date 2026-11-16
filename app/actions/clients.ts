"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db, clients, clientDevelopers, users, tickets } from "@/lib/db";
import { updateTicketLogged } from "@/lib/ticket-log";
import { CLOSING_ITEMS, ONBOARDING_ITEMS, SERVICES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { actor, adminActor, AppError, run, reqStr, optStr, optDate, optId, money, type ActionResult } from "@/lib/action";

const schema = z.object({
  name: reqStr("Client name", 200),
  contactName: optStr(200),
  phone: optStr(50),
  email: optStr(200),
  service: z.enum(SERVICES).default("Website"),
  value: money,
  startDate: optDate,
  leadId: optId,
  notes: optStr(5000),
  stage: z.enum(["ONBOARDING", "ACTIVE", "CLOSING", "CLOSED"]).default("ONBOARDING"),
  closedAt: optDate,
});

const allDone = (items: readonly (readonly [string, string])[]) => Object.fromEntries(items.map(([k]) => [k, true]));

export async function saveClient(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const { stage, closedAt, ...v } = schema.parse(input);
    // Admins can set any stage directly (e.g. to record existing or past clients).
    const closed = stage === "CLOSED" ? (closedAt ?? todayISO()) : null;
    if (id) {
      await db.update(clients).set({ ...v, stage, closedAt: closed }).where(eq(clients.id, id));
    } else {
      // A client added straight into a later stage has already been through the earlier checklists.
      id = (await db.insert(clients).values({
        ...v, stage, closedAt: closed,
        onboarding: stage !== "ONBOARDING" ? allDone(ONBOARDING_ITEMS) : {},
        closing: stage === "CLOSED" ? allDone(CLOSING_ITEMS) : {},
      }).returning({ id: clients.id }))[0]!.id;
    }
    revalidatePath("/", "layout");
    return { ok: true, id };
  });
}

export async function deleteClient(id: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    await db.delete(clients).where(eq(clients.id, id));
    revalidatePath("/", "layout");
  });
}

export async function assignDevelopers(clientId: string, userIds: string[]): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const ids = z.array(z.string()).max(50).parse(userIds);
    const valid = ids.length ? await db.select({ id: users.id }).from(users).where(inArray(users.id, ids)) : [];
    await db.transaction(async (tx) => {
      await tx.delete(clientDevelopers).where(eq(clientDevelopers.clientId, clientId));
      if (valid.length) await tx.insert(clientDevelopers).values(valid.map((u) => ({ clientId, userId: u.id })));
    });
    revalidatePath("/", "layout");
  });
}

/** Any signed-in user can tick checklist items. */
export async function toggleChecklist(clientId: string, kind: "onboarding" | "closing", key: string, value: boolean): Promise<ActionResult> {
  return run(async () => {
    await actor();
    const items = kind === "onboarding" ? ONBOARDING_ITEMS : CLOSING_ITEMS;
    if (!items.some(([k]) => k === key)) throw new AppError("Unknown checklist item.");
    const [c] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!c) throw new AppError("Client not found.");
    const next = { ...(c[kind] ?? {}), [key]: !!value };
    await db.update(clients).set(kind === "onboarding" ? { onboarding: next } : { closing: next }).where(eq(clients.id, clientId));
    revalidatePath("/clients");
  });
}

export async function setClientStage(clientId: string, stage: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const s = z.enum(["ONBOARDING", "ACTIVE", "CLOSING", "CLOSED"]).parse(stage);
    const [c] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!c) throw new AppError("Client not found.");
    if (c.stage === "ONBOARDING" && s === "ACTIVE") {
      const devs = await db.select().from(clientDevelopers).where(eq(clientDevelopers.clientId, clientId));
      if (!ONBOARDING_ITEMS.every(([k]) => c.onboarding?.[k]) || !devs.length)
        throw new AppError("Finish the onboarding checklist and assign at least one developer first.");
    }
    if (s === "CLOSED" && !CLOSING_ITEMS.every(([k]) => c.closing?.[k]))
      throw new AppError("Complete the closing checklist before closing this client.");
    await db.update(clients).set({ stage: s, closedAt: s === "CLOSED" ? todayISO() : null }).where(eq(clients.id, clientId));
    revalidatePath("/", "layout");
  });
}

const ticketPlan = z.array(z.object({
  ticketId: z.string(),
  action: z.enum(["done", "keep"]),
  assigneeId: optId,
})).max(500);

/**
 * Sorts out a client's open tickets (mark done, or keep open and reassign), and optionally closes the client.
 * Runs in one transaction, so nothing changes unless everything succeeds.
 */
export async function resolveClientTickets(clientId: string, plan: unknown, closeAfter: boolean): Promise<ActionResult> {
  return run(async () => {
    const me = await adminActor();
    const items = ticketPlan.parse(plan);
    const [c] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!c) throw new AppError("Client not found.");
    if (closeAfter && !CLOSING_ITEMS.every(([k]) => c.closing?.[k]))
      throw new AppError("Complete the closing checklist before closing this client.");
    const open = await db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.clientId, clientId), ne(tickets.status, "DONE")));
    const openIds = new Set(open.map((t) => t.id));
    if (closeAfter && open.some((t) => !items.find((i) => i.ticketId === t.id)))
      throw new AppError("A new ticket was added for this client. Reopen this window and try again.");
    await db.transaction(async (tx) => {
      for (const i of items) {
        if (!openIds.has(i.ticketId)) continue;
        await updateTicketLogged(tx, i.ticketId, me.id, i.action === "done" ? { status: "DONE" } : { assigneeId: i.assigneeId });
      }
      if (closeAfter) await tx.update(clients).set({ stage: "CLOSED", closedAt: todayISO() }).where(eq(clients.id, clientId));
    });
    revalidatePath("/", "layout");
  });
}
