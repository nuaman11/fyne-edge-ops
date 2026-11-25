"use client";

import type { DocDetail } from "@/lib/types";
import { PdfPages } from "@/components/docs/PdfPages";
import { fieldName, signerTone } from "@/components/docs/shared";

/** Read-only view: the signed PDF once complete, otherwise the original with boxes and any signatures so far. */
export function DocPreview({ doc }: { doc: DocDetail }) {
  if (doc.status === "COMPLETED" && doc.hasSignedFile) return <PdfPages src={`/api/documents/${doc.id}/file?kind=signed`} />;
  const idx = (signerId: string) => doc.signers.findIndex((s) => s.id === signerId);
  return (
    <PdfPages src={`/api/documents/${doc.id}/file`}
      overlay={(page) => doc.fields.filter((f) => f.page === page).map((f) => {
        const owner = doc.signers.find((s) => s.id === f.signerId);
        return (
          <div key={f.id} className={`fbox other tone-${signerTone(idx(f.signerId))}`} title={`${fieldName(f.type)} for ${owner?.name}`}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}>
            {f.value ? (f.value.startsWith("data:image") ? <img src={f.value} alt="" /> : <span className="fval">{f.value}</span>)
              : <span className="fbox-t">{fieldName(f.type)} · {owner?.name.split(" ")[0]}</span>}
          </div>
        );
      })} />
  );
}
