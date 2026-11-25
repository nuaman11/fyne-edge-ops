import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageDoc, getDocumentFor } from "@/lib/documents";
import { listClients, listUsers } from "@/lib/queries";
import { fmtDate, fmtWhen } from "@/lib/format";
import { PageHead, Pill } from "@/components/ui";
import { DocActions } from "@/components/docs/DocActions";
import { DocPreview } from "@/components/docs/DocPreview";
import { DocStatusPill, signerTone } from "@/components/docs/shared";

export const metadata = { title: "Document" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const doc = await getDocumentFor(me, id);
  if (!doc) notFound();
  const [users, clients] = await Promise.all([listUsers(), listClients()]);
  const nameOf = (uid: string | null) => (uid ? users.find((u) => u.id === uid)?.name ?? "Former user" : "FYNE EDGE Ops");
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const canManage = canManageDoc(me, doc);
  const mine = doc.signers.find((s) => s.userId === me.id);

  return (
    <>
      <PageHead title={doc.title} eyebrow={<Link href="/documents" className="link">← Documents</Link>}
        sub={<>{client ? <>{client.name} · </> : null}Created by {nameOf(doc.createdById)} on {fmtDate(doc.createdAt.slice(0, 10), true)}</>}>
        <DocActions doc={doc} meId={me.id} canManage={canManage} isAdmin={me.role === "ADMIN"} />
      </PageHead>

      {doc.status === "OUT_FOR_SIGNATURE" && mine?.status === "PENDING" ? (
        <div className="hint"><span><b>{nameOf(doc.createdById)}</b> asked you to sign this document.{doc.message ? ` “${doc.message}”` : ""}</span><Link className="btn sm primary" href={`/documents/${doc.id}/sign`}>Sign now</Link></div>
      ) : null}
      {doc.status === "VOIDED" ? <div className="notice"><span>Voided{doc.voidedAt ? ` on ${fmtDate(doc.voidedAt.slice(0, 10), true)}` : ""}: {doc.voidReason}</span></div> : null}
      {doc.status === "DRAFT" ? <div className="hint"><span>This is a draft. Add who needs to sign and where, then send it.</span></div> : null}

      <div className="doc-detail">
        <div className="doc-canvas"><DocPreview doc={doc} /></div>
        <aside className="doc-side">
          <section className="panel">
            <div className="ph"><h2>Status</h2><DocStatusPill doc={doc} meId={me.id} /></div>
            <div className="rows">
              {doc.signers.length ? doc.signers.map((s, i) => (
                <div className="row" key={s.id} style={{ cursor: "default" }}>
                  <span className={`sdot tone-${signerTone(i)}`} />
                  <div className="grow"><div className="t">{s.name}{s.userId === me.id ? " (you)" : ""}</div>
                    <div className="s">{s.status === "SIGNED" ? `Signed ${fmtWhen(s.signedAt)}` : s.status === "DECLINED" ? `Declined: ${s.declineReason}` : doc.status === "DRAFT" ? "Not sent yet" : "Waiting to sign"}</div></div>
                  <Pill tone={s.status === "SIGNED" ? "ok" : s.status === "DECLINED" ? "bad" : undefined}>{s.status === "SIGNED" ? "Signed" : s.status === "DECLINED" ? "Declined" : "Pending"}</Pill>
                </div>
              )) : <div className="empty">No signers yet.</div>}
            </div>
          </section>
          <section className="panel">
            <div className="ph"><h2>Details</h2></div>
            <dl className="kv">
              <dt>File</dt><dd>{doc.fileName}</dd>
              <dt>Size</dt><dd>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB · {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}</dd>
              {doc.sentAt ? <><dt>Sent</dt><dd>{fmtWhen(doc.sentAt)}</dd></> : null}
              {doc.completedAt ? <><dt>Completed</dt><dd>{fmtWhen(doc.completedAt)}</dd></> : null}
              <dt>Original SHA-256</dt><dd className="hash">{doc.fileSha256}</dd>
              {doc.signedSha256 ? <><dt>Signed SHA-256</dt><dd className="hash">{doc.signedSha256}</dd></> : null}
            </dl>
          </section>
          <section className="panel">
            <div className="ph"><h2>Activity <span className="n">{doc.events.length}</span></h2></div>
            <div className="tlist" style={{ maxHeight: 360 }}>
              {doc.events.slice().reverse().map((e) => (
                <div className="logline" key={e.id}><span className="dot" /><span><b>{nameOf(e.actorId)}</b> {e.detail}</span><span className="w">{fmtWhen(e.createdAt)}</span></div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
