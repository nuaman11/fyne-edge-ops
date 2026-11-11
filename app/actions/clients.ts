"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, clients, clientDevelopers, users } from "@/lib/db";
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
