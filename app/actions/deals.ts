"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, deals, clients } from "@/lib/db";
import { SERVICES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { adminActor, AppError, run, reqStr, optStr, optDate, money, type ActionResult } from "@/lib/action";

const stages = ["LEAD", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
const schema = z.object({
  company: reqStr("Company", 200),
  contactName: optStr(200),
  service: z.enum(SERVICES).default("Website"),
  value: money,
  stage: z.enum(stages).default("LEAD"),
  expectedClose: optDate,
  source: optStr(200),
  nextAction: optStr(500),
  notes: optStr(5000),
});

export async function saveDeal(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const v = schema.parse(input);
    if (id) await db.update(deals).set(v).where(eq(deals.id, id));
    else id = (await db.insert(deals).values(v).returning({ id: deals.id }))[0]!.id;
    revalidatePath("/", "layout");
    return { ok: true, id };
  });
}

export async function setDealStage(id: string, stage: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    await db.update(deals).set({ stage: z.enum(stages).parse(stage) }).where(eq(deals.id, id));
    revalidatePath("/", "layout");
  });
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    await db.delete(deals).where(eq(deals.id, id));
    revalidatePath("/", "layout");
  });
}

/** Turns a won deal into a client in onboarding. */
export async function convertDeal(id: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const [d] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
    if (!d) throw new AppError("Deal not found.");
    if (d.clientId) throw new AppError("This deal is already a client.");
    const clientId = await db.transaction(async (tx) => {
      const [c] = await tx.insert(clients).values({
        name: d.company, contactName: d.contactName, service: d.service, value: d.value,
        startDate: todayISO(), notes: d.notes, fromDealId: d.id,
      }).returning({ id: clients.id });
      await tx.update(deals).set({ clientId: c!.id, stage: "WON" }).where(eq(deals.id, id));
      return c!.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, id: clientId };
  });
}
