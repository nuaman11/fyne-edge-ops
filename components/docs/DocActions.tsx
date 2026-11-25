"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDocument, duplicateDocument, finalizeDocument, voidDocument } from "@/app/actions/documents";
import type { DocDetail } from "@/lib/types";
import { toast } from "@/components/Toaster";
import { FormModal } from "@/components/FormModal";

/** Buttons on a document's page; what shows depends on its status and who is looking. */
export function DocActions({ doc, meId, canManage, isAdmin }: { doc: DocDetail; meId: string; canManage: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [voiding, setVoiding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mine = doc.signers.find((s) => s.userId === meId);
  const allSigned = doc.signers.length > 0 && doc.signers.every((s) => s.status === "SIGNED");
  const file = `/api/documents/${doc.id}/file`;

  const act = (fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, after: (id?: string) => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { toast(r.error || "Something went wrong."); return; }
    after(r.id);
  });

  const canDelete = canManage && (doc.status === "DRAFT" || doc.status === "VOIDED" || (doc.status === "COMPLETED" && isAdmin));

  return (
    <>
      {doc.status === "OUT_FOR_SIGNATURE" && mine?.status === "PENDING" ? <Link className="btn primary" href={`/documents/${doc.id}/sign`}>Sign now</Link> : null}
      {doc.status === "DRAFT" && canManage ? <Link className="btn primary" href={`/documents/${doc.id}/edit`}>Add signers and send</Link> : null}
      {doc.status === "COMPLETED" && doc.hasSignedFile ? <a className="btn primary" href={`${file}?kind=signed&download=1`}>Download signed PDF</a> : null}
      {doc.status === "OUT_FOR_SIGNATURE" && allSigned && canManage ? (
        <button type="button" className="btn primary" disabled={pending} onClick={() => act(() => finalizeDocument(doc.id), () => { toast("Signed PDF created."); router.refresh(); })}>Create signed PDF</button>
      ) : null}
      <a className="btn" href={`${file}?download=1`}>Original PDF</a>
      {canManage && doc.status !== "DRAFT" ? (
        <button type="button" className="btn" disabled={pending} onClick={() => act(() => duplicateDocument(doc.id), (id) => { toast("Copied to a new draft."); router.push(`/documents/${id}/edit`); })}>
          {doc.status === "VOIDED" ? "Make a new version" : "Duplicate"}
        </button>
      ) : null}
      {canManage && doc.status === "OUT_FOR_SIGNATURE" ? <button type="button" className="btn danger" onClick={() => setVoiding(true)}>Void</button> : null}
      {canDelete ? (confirmDelete
        ? <button type="button" className="btn danger-solid" disabled={pending} onClick={() => act(() => deleteDocument(doc.id), () => { toast("Document deleted."); router.push("/documents"); })}>Click again to delete</button>
        : <button type="button" className="btn ghost danger" onClick={() => { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); }}>Delete</button>) : null}

      {voiding ? (
        <FormModal title="Void this document" submitLabel="Void document"
          intro={<p className="mtext">Signers won’t be able to sign it any more. Signatures already given stay in the activity record.</p>}
          fields={[{ name: "reason", label: "Reason", type: "textarea", full: true, required: true }]}
          onSubmit={async (v) => { const r = await voidDocument(doc.id, v.reason); if (r.ok) { toast("Document voided."); router.refresh(); } return r; }}
          onClose={() => setVoiding(false)} />
      ) : null}
    </>
  );
}
