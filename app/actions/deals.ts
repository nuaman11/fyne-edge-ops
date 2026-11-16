"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, deals, clients } from "@/lib/db";
import { LOST_REASONS, SERVICES } from "@/lib/constants";
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
  lostReason: z.string().optional().nullable().transform((v) => (v ? v : null)),
  lostNote: optStr(2000),
});
const lostKeys = LOST_REASONS.map(([k]) => k) as string[];

/** A lost deal must say why; any other stage clears the reason. */
function lostFields(stage: string, reason: string | null | undefined, note: string | null | undefined) {
  if (stage !== "LOST") return { lostReason: null, lostNote: null };
  if (!reason || !lostKeys.includes(reason)) throw new AppError("Pick why the deal was lost.");
  return { lostReason: reason, lostNote: note ? String(note).trim().slice(0, 2000) || null : null };
}

export async function saveDeal(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const { lostReason, lostNote, ...rest } = schema.parse(input);
    const v = { ...rest, ...lostFields(rest.stage, lostReason, lostNote) };
    if (id) await db.update(deals).set(v).where(eq(deals.id, id));
    else id = (await db.insert(deals).values(v).returning({ id: deals.id }))[0]!.id;
    revalidatePath("/", "layout");
    return { ok: true, id };
  });
}

export async function setDealStage(id: string, stage: string, lostReason?: string | null, lostNote?: string | null): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const s = z.enum(stages).parse(stage);
    await db.update(deals).set({ stage: s, ...lostFields(s, lostReason, lostNote) }).where(eq(deals.id, id));
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
      await tx.update(deals).set({ clientId: c!.id, stage: "WON", lostReason: null, lostNote: null }).where(eq(deals.id, id));
      return c!.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, id: clientId };
  });
}
