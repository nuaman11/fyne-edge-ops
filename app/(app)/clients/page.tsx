import { and, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, tickets } from "@/lib/db";
import { listClients, listUsers } from "@/lib/queries";
import { ClientsView } from "@/components/ClientsView";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const me = await requireUser();
  const [clients, users, open] = await Promise.all([
    listClients(), listUsers(),
    db.select({ clientId: tickets.clientId }).from(tickets).where(and(ne(tickets.status, "DONE"))),
  ]);
  const openByClient: Record<string, number> = {};
  for (const t of open) if (t.clientId) openByClient[t.clientId] = (openByClient[t.clientId] ?? 0) + 1;
  return <ClientsView isAdmin={me.role === "ADMIN"} clients={clients} users={users} openByClient={openByClient} />;
}
