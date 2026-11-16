import { requireUser } from "@/lib/auth";
import { listDeals } from "@/lib/queries";
import { PipelineView } from "@/components/PipelineView";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  return <PipelineView isAdmin={me.role === "ADMIN"} deals={await listDeals()} initial={{ openId: sp.open, newDeal: sp.new === "1" }} />;
}
