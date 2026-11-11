import { requireUser } from "@/lib/auth";
import { listHiring, listUsers } from "@/lib/queries";
import { HiringView } from "@/components/HiringView";

export const metadata = { title: "Hiring approvals" };

export default async function HiringPage() {
  const me = await requireUser();
  const [hiring, users] = await Promise.all([listHiring(), listUsers()]);
  return <HiringView me={{ id: me.id, name: me.name, role: me.role, department: me.department, isDeptHead: me.isDeptHead }} hiring={hiring} users={users} />;
}
