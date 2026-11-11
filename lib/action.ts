import "server-only";
import { z } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export type { ActionResult } from "./action-types";
import type { ActionResult } from "./action-types";

export class AppError extends Error {}

export async function actor(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new AppError("Your session has ended. Sign in again.");
  return u;
}
export async function adminActor(): Promise<SessionUser> {
  const u = await actor();
  if (u.role !== "ADMIN") throw new AppError("Only admins can do this.");
  return u;
}

/** Runs an action body and turns expected failures into a friendly { ok:false, error }. */
export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message || "Check the form and try again." };
    if (e instanceof AppError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

// Reusable field validators
export const reqStr = (label: string, max = 200) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
export const optStr = (max = 2000) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
export const optDate = z.string().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date.");
export const optId = z.string().optional().nullable().transform((v) => (v ? v : null));
export const money = z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
  const n = Math.round(Number(v || 0));
  return Number.isFinite(n) && n >= 0 ? n : 0;
});
