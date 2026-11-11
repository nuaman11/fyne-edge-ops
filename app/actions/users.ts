"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/constants";
import { adminActor, AppError, run, optStr, type ActionResult } from "@/lib/action";

const password = z.string().min(10, "Password must be at least 10 characters.").max(200);
const base = {
  name: z.string().trim().min(1, "Name is required.").max(100),
  email: z.email("Enter a valid email.").transform((v) => v.trim().toLowerCase()),
  role: z.enum(["ADMIN", "USER"]),
  department: z.enum(DEPARTMENTS),
  jobTitle: optStr(100),
  isDeptHead: z.boolean().default(false),
};

async function otherActiveAdmins(excludeId: string) {
  const [{ n }] = await db.select({ n: count() }).from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.active, true), ne(users.id, excludeId)));
  return n;
}
async function emailTaken(email: string, excludeId?: string) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return !!u && u.id !== excludeId;
}

export async function createUser(input: unknown): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const v = z.object({ ...base, password }).parse(input);
    if (await emailTaken(v.email)) throw new AppError("A user with this email already exists.");
    const [u] = await db.insert(users).values({
      name: v.name, email: v.email, role: v.role, department: v.department, jobTitle: v.jobTitle,
      isDeptHead: v.isDeptHead, passwordHash: await bcrypt.hash(v.password, 12),
    }).returning({ id: users.id });
    revalidatePath("/", "layout");
    return { ok: true, id: u!.id };
  });
}

export async function updateUser(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await adminActor();
    const v = z.object({ ...base, active: z.boolean().default(true) }).parse(input);
    const [cur] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!cur) throw new AppError("User not found.");
    if (id === me.id && (v.role !== "ADMIN" || !v.active)) throw new AppError("You can’t remove your own admin access or disable yourself.");
    if (cur.role === "ADMIN" && cur.active && (v.role !== "ADMIN" || !v.active) && (await otherActiveAdmins(id)) === 0)
      throw new AppError("There must always be at least one active admin.");
    if (await emailTaken(v.email, id)) throw new AppError("Another user already has this email.");
    const accessChanged = cur.role !== v.role || cur.active !== v.active || cur.email !== v.email;
    await db.update(users).set({
      name: v.name, email: v.email, role: v.role, department: v.department, jobTitle: v.jobTitle,
      isDeptHead: v.isDeptHead, active: v.active,
      sessionVersion: accessChanged ? cur.sessionVersion + 1 : cur.sessionVersion,
      ...(v.active && !cur.active ? { failedLogins: 0, lockedUntil: null } : {}),
    }).where(eq(users.id, id));
    revalidatePath("/", "layout");
  });
}

export async function resetUserPassword(id: string, newPassword: string): Promise<ActionResult> {
  return run(async () => {
    await adminActor();
    const pw = password.parse(newPassword);
    const [cur] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!cur) throw new AppError("User not found.");
    await db.update(users).set({
      passwordHash: await bcrypt.hash(pw, 12), sessionVersion: cur.sessionVersion + 1, failedLogins: 0, lockedUntil: null,
    }).where(eq(users.id, id));
    revalidatePath("/users");
  });
}

export async function deleteUser(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await adminActor();
    if (id === me.id) throw new AppError("You can’t delete your own account.");
    const [cur] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!cur) return;
    if (cur.role === "ADMIN" && cur.active && (await otherActiveAdmins(id)) === 0) throw new AppError("There must always be at least one active admin.");
    await db.delete(users).where(eq(users.id, id));
    revalidatePath("/", "layout");
  });
}
