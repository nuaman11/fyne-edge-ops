"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { endSession, getCurrentUser, startSession } from "@/lib/auth";

export type FormState = { error?: string; success?: string } | undefined;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = "$2b$12$yJG5SE2avr9JE0JomzoIFeG2CPuvzknX.Hu76/q1NsAgrwTufQvgm";

const passwordRule = z.string().min(10, "Password must be at least 10 characters.").max(200);

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };

  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = await bcrypt.compare(password, u?.passwordHash ?? DUMMY_HASH);

  if (u?.lockedUntil && u.lockedUntil > new Date()) {
    const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  if (!u || !ok) {
    if (u) {
      const fails = u.failedLogins + 1;
      await db.update(users).set({
        failedLogins: fails >= MAX_ATTEMPTS ? 0 : fails,
        lockedUntil: fails >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      }).where(eq(users.id, u.id));
    }
    return { error: "Email or password is incorrect." };
  }
  if (!u.active) return { error: "This account has been disabled. Contact an admin." };

  await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await startSession(u);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}


const setupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.email("Enter a valid email.").transform((v) => v.trim().toLowerCase()),
  password: passwordRule,
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: "Passwords don’t match.", path: ["confirm"] });

/** One-time setup: creates the first admin. Refuses once any user exists. */
export async function setupAdmin(_: FormState, form: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 12);

  // Insert only if the users table is still empty (guards against two people running setup at once).
  const inserted = await db.execute(sql`
    INSERT INTO users (id, name, email, password_hash, role, department, active)
    SELECT ${crypto.randomUUID()}, ${name}, ${email}, ${hash}, 'ADMIN', 'Management', true
    WHERE NOT EXISTS (SELECT 1 FROM users)
    RETURNING id`);
  if (!inserted.rows.length) return { error: "Setup is already complete. Sign in instead." };

  const [u] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.email, email)).returning();
  await startSession(u!);
  redirect("/");
}

const changeSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  password: passwordRule,
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: "New passwords don’t match.", path: ["confirm"] });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const parsed = changeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [u] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!u || !(await bcrypt.compare(parsed.data.current, u.passwordHash))) return { error: "Current password is incorrect." };
  const [updated] = await db.update(users).set({
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    sessionVersion: u.sessionVersion + 1,
  }).where(eq(users.id, u.id)).returning();
  await startSession(updated!); // signs out other devices, keeps this one
  return { success: "Password updated. You’ve been signed out on other devices." };
}
