import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/queries";
import { storageMode } from "@/lib/storage";
import { PageHead } from "@/components/ui";
import { NewDocumentForm } from "@/components/docs/NewDocumentForm";

export const metadata = { title: "New document" };

export default async function NewDocumentPage() {
  const me = await requireUser();
  const clients = (await listClients()).filter((c) => c.stage !== "CLOSED").map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHead title="New document" eyebrow={<Link href="/documents" className="link">← Documents</Link>} sub="Step 1 of 2: upload the PDF. Next you’ll choose who signs and where." />
      <div style={{ maxWidth: 720 }}><NewDocumentForm meId={me.id} mode={storageMode()} clients={clients} /></div>
    </>
  );
}
