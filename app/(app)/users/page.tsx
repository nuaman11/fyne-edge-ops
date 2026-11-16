import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { UsersView } from "@/components/UsersView";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return (
    <UsersView
      meId={me.id}
      openId={sp.open}
      users={rows.map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, jobTitle: u.jobTitle,
        isDeptHead: u.isDeptHead, active: u.active, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString(),
        locked: !!(u.lockedUntil && u.lockedUntil > new Date()),
      }))}
    />
  );
}
