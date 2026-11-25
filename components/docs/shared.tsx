import { DOCUMENT_STATUSES, FIELD_TYPES, label } from "@/lib/constants";
import type { DocListRow } from "@/lib/types";

const TONES = ["acc", "ok", "warn", "bad", "muted"] as const;
/** Colour for the n-th signer, so each person's boxes are easy to tell apart. */
export const signerTone = (i: number) => TONES[(i < 0 ? 0 : i) % TONES.length]!;

export const fieldName = (type: string) => FIELD_TYPES.find(([t]) => t === type)?.[1] ?? type;

export function DocStatusPill({ doc, meId }: { doc: Pick<DocListRow, "status" | "signers">; meId?: string }) {
  if (doc.status === "OUT_FOR_SIGNATURE") {
    const mine = meId ? doc.signers.find((s) => s.userId === meId) : undefined;
    const signed = doc.signers.filter((s) => s.status === "SIGNED").length;
    if (mine?.status === "PENDING") return <span className="pill warn">Needs your signature</span>;
    return <span className="pill acc">{signed}/{doc.signers.length} signed</span>;
  }
  const tone = doc.status === "COMPLETED" ? "ok" : doc.status === "VOIDED" ? "bad" : "";
  return <span className={`pill ${tone}`}>{label(DOCUMENT_STATUSES, doc.status)}</span>;
}
