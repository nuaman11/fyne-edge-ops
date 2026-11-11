"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, tickets } from "@/lib/db";
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

/** Any signed-in user can create and edit tickets. */
export async function saveTicket(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const v = schema.parse(input);
    if (id) {
      const r = await db.update(tickets).set(v).where(eq(tickets.id, id)).returning({ id: tickets.id });
      if (!r.length) throw new AppError("Ticket not found. It may have been deleted.");
    } else {
      const [r] = await db.insert(tickets).values({ ...v, createdById: me.id }).returning({ id: tickets.id });
      id = r!.id;
    }
    revalidatePath("/", "layout");
    return { ok: true, id };
  });
}

export async function setTicketStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    await actor();
    const s = z.enum(statuses).parse(status);
    await db.update(tickets).set({ status: s }).where(eq(tickets.id, id));
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
