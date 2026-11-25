import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageDoc, getDocumentFor } from "@/lib/documents";
import { listClients, listUsers } from "@/lib/queries";
import { PageHead } from "@/components/ui";
import { DocumentEditor } from "@/components/docs/DocumentEditor";

export const metadata = { title: "Prepare document" };

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const doc = await getDocumentFor(me, id);
  if (!doc) notFound();
  if (!canManageDoc(me, doc) || doc.status !== "DRAFT") redirect(`/documents/${id}`);
  const [users, clients] = await Promise.all([listUsers(), listClients()]);
  return (
    <>
      <PageHead title={doc.title} eyebrow={<Link href="/documents" className="link">← Documents</Link>} sub="Step 2 of 2: add who signs, place their boxes on the pages, then send." />
      <DocumentEditor doc={doc} users={users} clients={clients.filter((c) => c.stage !== "CLOSED" || c.id === doc.clientId).map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
