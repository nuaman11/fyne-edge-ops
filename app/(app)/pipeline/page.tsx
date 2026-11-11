import { requireUser } from "@/lib/auth";
import { listDeals } from "@/lib/queries";
import { PipelineView } from "@/components/PipelineView";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const me = await requireUser();
  return <PipelineView isAdmin={me.role === "ADMIN"} deals={await listDeals()} />;
}
