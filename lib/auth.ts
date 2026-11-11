import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/session-token";

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "department" | "isDeptHead" | "jobTitle">;

/** Current signed-in user, checked against the database on every request (so deactivation and role changes apply immediately). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const [u] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!u || !u.active || u.sessionVersion !== payload.v) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, isDeptHead: u.isDeptHead, jobTitle: u.jobTitle };
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

export async function startSession(u: Pick<User, "id" | "role" | "sessionVersion">) {
  const token = await signSession({ sub: u.id, role: u.role, v: u.sessionVersion });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
