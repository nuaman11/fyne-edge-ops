import { count, ne, notInArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, tickets, clients, deals } from "@/lib/db";
import { listHiring } from "@/lib/queries";
import { hiringStatus } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/Toaster";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const [[t], [c], [d], hiring] = await Promise.all([
    db.select({ n: count() }).from(tickets).where(ne(tickets.status, "DONE")),
    db.select({ n: count() }).from(clients).where(ne(clients.stage, "CLOSED")),
    db.select({ n: count() }).from(deals).where(notInArray(deals.stage, ["WON", "LOST"])),
    listHiring(),
  ]);
  const items = [
    { href: "/", label: "Overview" },
    { href: "/tickets", label: "Tickets", count: t!.n },
    { href: "/calendar", label: "Calendar" },
    { href: "/clients", label: "Clients", count: c!.n },
    { href: "/hiring", label: "Hiring approvals", count: hiring.filter((h) => hiringStatus(h) === "pending").length },
    { href: "/pipeline", label: "Pipeline", count: d!.n },
    ...(me.role === "ADMIN" ? [{ href: "/users", label: "Users" }] : []),
    { href: "/account", label: "My account" },
  ];
  return (
    <div className="app">
      <Sidebar items={items} me={{ name: me.name, role: me.role }} />
      <main className="main">{children}</main>
      <Toaster />
    </div>
  );
}
