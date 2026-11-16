import { requireUser } from "@/lib/auth";
import { listClients, listTickets, listUsers } from "@/lib/queries";
import { TicketsView } from "@/components/TicketsView";

export const metadata = { title: "Tickets" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const [tickets, users, clients] = await Promise.all([listTickets(), listUsers(), listClients()]);
  return (
    <TicketsView
      me={{ id: me.id, name: me.name, role: me.role, department: me.department, isDeptHead: me.isDeptHead }}
      tickets={tickets}
      users={users}
      clients={clients.map((c) => ({ id: c.id, name: c.name, stage: c.stage }))}
      initial={{ newTicket: sp.new === "1", openId: sp.open, mine: sp.mine === "1", clientId: sp.client, due: sp.due, filter: sp.filter, assigneeId: sp.assignee }}
    />
  );
}
