import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listDocumentsFor } from "@/lib/documents";
import { listClients } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { EmptyState, PageHead } from "@/components/ui";
import { DocStatusPill } from "@/components/docs/shared";
import type { DocListRow } from "@/lib/types";

export const metadata = { title: "Documents" };

const TABS = [
  ["mine", "Needs my signature"],
  ["out", "Out for signature"],
  ["completed", "Completed"],
  ["drafts", "Drafts"],
  ["voided", "Voided"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const [docs, clients] = await Promise.all([listDocumentsFor(me), listClients()]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const match = (d: DocListRow, t: Tab) => {
    switch (t) {
      case "mine": return d.status === "OUT_FOR_SIGNATURE" && d.signers.some((s) => s.userId === me.id && s.status === "PENDING");
      case "out": return d.status === "OUT_FOR_SIGNATURE";
      case "completed": return d.status === "COMPLETED";
      case "drafts": return d.status === "DRAFT";
      case "voided": return d.status === "VOIDED";
    }
  };
  const counts = Object.fromEntries(TABS.map(([k]) => [k, docs.filter((d) => match(d, k)).length])) as Record<Tab, number>;
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0]) ?? (counts.mine ? "mine" : counts.out ? "out" : counts.drafts ? "drafts" : counts.completed ? "completed" : "mine");
  const list = docs.filter((d) => match(d, tab));

  const EMPTY: Record<Tab, [string, string]> = {
    mine: ["Nothing to sign", "When someone sends you a document to sign, it shows up here."],
    out: ["Nothing out for signature", "Upload a PDF, add who needs to sign and where, then send it."],
    completed: ["No signed documents yet", "Once everyone has signed, the signed PDF with its signature certificate is kept here."],
    drafts: ["No drafts", "Documents you’ve uploaded but not sent yet stay here."],
    voided: ["No voided documents", "Documents that were cancelled or declined are kept here for reference."],
  };

  return (
    <>
      <PageHead title="Documents" sub="Upload a PDF, place signature boxes for your team, and collect signatures inside the app.">
        <Link className="btn primary" href="/documents/new">+ New document</Link>
      </PageHead>
      <div className="tabs">
        {TABS.map(([k, l]) => <Link key={k} href={`/documents?tab=${k}`} className={k === tab ? "on" : ""} scroll={false}>{l}<span className="n">{counts[k]}</span></Link>)}
      </div>
      {!list.length ? (
        <EmptyState title={EMPTY[tab][0]} actions={tab === "out" || tab === "drafts" || !docs.length ? <Link className="btn primary" href="/documents/new">+ Upload a PDF</Link> : undefined}>{EMPTY[tab][1]}</EmptyState>
      ) : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Document</th><th>Client</th><th>Signers</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td><Link className="rowlink" href={`/documents/${d.id}${tab === "mine" ? "/sign" : ""}`}>{d.title}</Link></td>
                  <td>{d.clientId ? clientName.get(d.clientId) ?? "—" : "—"}</td>
                  <td>{d.signers.length ? d.signers.map((s) => s.name.split(" ")[0]).join(", ") : <span className="fine">None yet</span>}</td>
                  <td><DocStatusPill doc={d} meId={me.id} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtDate((d.completedAt ?? d.sentAt ?? d.createdAt).slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
