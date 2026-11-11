import { requireUser } from "@/lib/auth";
import { listClients, listDeals, listTickets } from "@/lib/queries";
import { CalendarView } from "@/components/CalendarView";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  await requireUser();
  const [tickets, clients, deals] = await Promise.all([listTickets(), listClients(), listDeals()]);
  return (
    <CalendarView
      tickets={tickets.filter((t) => t.dueDate).map((t) => ({ id: t.id, title: t.title, number: t.number, dueDate: t.dueDate!, priority: t.priority, status: t.status }))}
      kickoffs={clients.filter((c) => c.startDate).map((c) => ({ id: c.id, name: c.name, date: c.startDate! }))}
      closes={deals.filter((d) => d.expectedClose && d.stage !== "WON" && d.stage !== "LOST").map((d) => ({ id: d.id, company: d.company, date: d.expectedClose! }))}
    />
  );
}
