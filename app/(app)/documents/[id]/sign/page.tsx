import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, documentEvents } from "@/lib/db";
import { getDocumentFor, requestMeta } from "@/lib/documents";
import { DocumentSigner } from "@/components/docs/DocumentSigner";

export const metadata = { title: "Sign document" };

export default async function SignDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const doc = await getDocumentFor(me, id);
  if (!doc) notFound();
  const mine = doc.signers.find((s) => s.userId === me.id);
  if (doc.status !== "OUT_FOR_SIGNATURE" || !mine || mine.status !== "PENDING") redirect(`/documents/${id}`);
  // Record the first time each signer opens the document, for the audit trail.
  const detail = "opened the document to sign";
  const [seen] = await db.select({ id: documentEvents.id }).from(documentEvents)
    .where(and(eq(documentEvents.documentId, id), eq(documentEvents.actorId, me.id), eq(documentEvents.detail, detail))).limit(1);
  if (!seen) { const { ip } = await requestMeta(); await db.insert(documentEvents).values({ documentId: id, actorId: me.id, detail, ip }); }
  return <DocumentSigner doc={doc} me={{ id: me.id, name: me.name }} />;
}
