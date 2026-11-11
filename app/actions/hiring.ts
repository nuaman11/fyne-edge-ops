"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, hiringRequests, hiringApprovals } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/constants";
import { canApproveDept } from "@/lib/types";
import { actor, adminActor, AppError, run, reqStr, optStr, optDate, type ActionResult } from "@/lib/action";

const schema = z.object({
  candidate: reqStr("Candidate name", 200),
  position: reqStr("Role", 200),
  department: z.enum(DEPARTMENTS),
  startDate: optDate,
  notes: optStr(5000),
  requiredDepartments: z.array(z.enum(DEPARTMENTS)).min(1, "Pick at least one approving department."),
});

export async function saveHiring(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await adminActor();
    const v = schema.parse(input);
    if (id) await db.update(hiringRequests).set(v).where(eq(hiringRequests.id, id));
    else id = (await db.insert(hiringRequests).values({ ...v, createdById: me.id }).returning({ id: hiringRequests.id }))[0]!.id;
    revalidatePath("/", "layout");
    return { ok: true, id };
  });
}

export async function deleteHiring(id: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    await db.delete(hiringRequests).where(eq(hiringRequests.id, id));
    revalidatePath("/", "layout");
  });
}

/** Admins, or the head of that department, can decide. */
export async function decideHiring(requestId: string, department: string, decision: "APPROVED" | "REJECTED"): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const d = z.enum(["APPROVED", "REJECTED"]).parse(decision);
    const [req] = await db.select().from(hiringRequests).where(eq(hiringRequests.id, requestId)).limit(1);
    if (!req) throw new AppError("Hiring request not found.");
    if (!req.requiredDepartments.includes(department)) throw new AppError("That department isn’t an approver on this request.");
    if (!canApproveDept(me, department)) throw new AppError(`Only an admin or the ${department} head can decide for ${department}.`);
    await db.insert(hiringApprovals).values({ requestId, department, decision: d, decidedById: me.id })
      .onConflictDoUpdate({ target: [hiringApprovals.requestId, hiringApprovals.department], set: { decision: d, decidedById: me.id, decidedAt: new Date() } });
    revalidatePath("/", "layout");
  });
}

export async function undoHiringDecision(requestId: string, department: string): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const [a] = await db.select().from(hiringApprovals)
      .where(and(eq(hiringApprovals.requestId, requestId), eq(hiringApprovals.department, department))).limit(1);
    if (!a) return;
    if (me.role !== "ADMIN" && a.decidedById !== me.id) throw new AppError("Only an admin or the person who decided can undo this.");
    await db.delete(hiringApprovals).where(eq(hiringApprovals.id, a.id));
    revalidatePath("/", "layout");
  });
}
