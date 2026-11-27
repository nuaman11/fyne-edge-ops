import { and, count, eq, ne, notInArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, tickets, clients, deals, documents, documentSigners } from "@/lib/db";
import { listHiring } from "@/lib/queries";
import { hiringStatus } from "@/lib/types";
import { Sidebar, type NavGroup } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Toaster } from "@/components/Toaster";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const [[t], [c], [d], hiring, [toSign]] = await Promise.all([
    db.select({ n: count() }).from(tickets).where(ne(tickets.status, "DONE")),
    db.select({ n: count() }).from(clients).where(ne(clients.stage, "CLOSED")),
    db.select({ n: count() }).from(deals).where(notInArray(deals.stage, ["WON", "LOST"])),
    listHiring(),
    db.select({ n: count() }).from(documentSigners).innerJoin(documents, eq(documents.id, documentSigners.documentId))
      .where(and(eq(documentSigners.userId, me.id), eq(documentSigners.status, "PENDING"), eq(documents.status, "OUT_FOR_SIGNATURE"))),
  ]);
  const groups: NavGroup[] = [
    { label: "Workspace", items: [
      { href: "/", label: "Overview", icon: "home" },
      { href: "/tickets", label: "Tickets", icon: "ticket", count: t!.n },
      { href: "/calendar", label: "Calendar", icon: "cal" },
      { href: "/documents", label: "Documents", icon: "doc", count: toSign!.n },
    ] },
    { label: "Sales & delivery", items: [
      { href: "/pipeline", label: "Pipeline", icon: "funnel", count: d!.n },
      { href: "/clients", label: "Clients", icon: "brief", count: c!.n },
      { href: "/projects", label: "Projects", icon: "grid" },
    ] },
    { label: "People", items: [
      { href: "/hiring", label: "Hiring approvals", icon: "hire", count: hiring.filter((h) => hiringStatus(h) === "pending").length },
      ...(me.role === "ADMIN" ? [{ href: "/users", label: "Users", icon: "users" }] : []),
      { href: "/account", label: "My account", icon: "user" },
    ] },
  ];
  return (
    <div className="app">
      <Sidebar groups={groups} me={{ name: me.name, role: me.role, isDeptHead: me.isDeptHead }} />
      <main className="main">
        <div className="topbar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/" className="mbrand" aria-label="FYNE EDGE Ops home"><img src="/brand/logo-light.png" alt="FYNE EDGE" /></Link>
          <GlobalSearch />
        </div>
        <div className="view">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
