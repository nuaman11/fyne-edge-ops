import { ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, tickets } from "@/lib/db";
import { listClients, listUsers } from "@/lib/queries";
import { ClientsView, type OpenTicket } from "@/components/ClientsView";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const [clients, users, open] = await Promise.all([
    listClients(), listUsers(),
    db.select({ id: tickets.id, number: tickets.number, title: tickets.title, status: tickets.status, dueDate: tickets.dueDate, assigneeId: tickets.assigneeId, clientId: tickets.clientId })
      .from(tickets).where(ne(tickets.status, "DONE")),
  ]);
  const openByClient: Record<string, OpenTicket[]> = {};
  for (const t of open) if (t.clientId) (openByClient[t.clientId] ??= []).push(t);
  return <ClientsView isAdmin={me.role === "ADMIN"} clients={clients} users={users} openByClient={openByClient}
    initial={{ tab: sp.tab, openId: sp.open, newClient: sp.new === "1" }} />;
}
