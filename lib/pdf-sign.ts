import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { TZ } from "@/lib/format";

export type StampField = { type: "SIGNATURE" | "INITIALS" | "DATE" | "NAME" | "TEXT"; page: number; x: number; y: number; w: number; h: number; value: string | null };
export type AuditInfo = {
  documentId: string; title: string; fileName: string; pageCount: number; originalSha256: string;
  createdBy: string; createdAt: Date; sentAt: Date | null; completedAt: Date;
  signers: { name: string; email: string; signedAt: Date | null; ip: string | null; userAgent: string | null; signature: string | null }[];
};

/** Reads a PDF and checks it can be signed. Throws a readable error if not. */
export async function inspectPdf(bytes: Uint8Array) {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/encrypt/i.test(msg)) throw new Error("This PDF is password-protected. Remove the password and upload it again.");
    throw new Error("This file isn't a readable PDF.");
  }
  const pageCount = pdf.getPageCount();
  if (!pageCount) throw new Error("This PDF has no pages.");
  if (pageCount > 200) throw new Error("This PDF has more than 200 pages. Split it into smaller documents.");
  return { pageCount };
}

/** Page geometry as the signer saw it (pdf.js renders the crop box, rotated). */
function geometry(page: PDFPage) {
  const box = page.getCropBox();
  const r = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const W = box.width, H = box.height;
  const vw = r % 180 === 0 ? W : H, vh = r % 180 === 0 ? H : W;
  /** Point in displayed page units (origin top-left) → PDF user space. */
  const map = (x: number, y: number) => {
    switch (r) {
      case 90: return { x: box.x + y, y: box.y + x };
      case 180: return { x: box.x + W - x, y: box.y + y };
      case 270: return { x: box.x + W - y, y: box.y + H - x };
      default: return { x: box.x + x, y: box.y + H - y };
    }
  };
  return { r, vw, vh, map };
}

/** Helvetica only covers Western characters; anything else becomes "?" instead of failing the whole document. */
function safeText(font: PDFFont, text: string) {
  return Array.from(text).map((ch) => { try { font.encodeText(ch); return ch; } catch { return "?"; } }).join("");
}

function fitSize(font: PDFFont, text: string, maxW: number, maxH: number) {
  let size = Math.min(maxH * 0.68, 13);
  while (size > 5 && font.widthOfTextAtSize(text, size) > maxW) size -= 0.5;
  return size;
}

const fmtTime = (d: Date | null) => d ? `${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, dateStyle: "medium", timeStyle: "medium" }).format(d)} (${TZ})` : "—";

/** Draws every filled field onto the original PDF and appends a signature certificate page. */
export async function stampDocument(original: Uint8Array, fields: StampField[], audit: AuditInfo): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  const ink = rgb(0.06, 0.1, 0.32);
  const images = new Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>();

  for (const f of fields) {
    if (!f.value) continue;
    const page = pages[f.page - 1];
    if (!page) continue;
    const g = geometry(page);
    const bx = f.x * g.vw, by = f.y * g.vh, bw = f.w * g.vw, bh = f.h * g.vh;

    if (f.type === "SIGNATURE" || f.type === "INITIALS") {
      let img = images.get(f.value);
      if (!img) {
        const b64 = f.value.replace(/^data:image\/png;base64,/, "");
        img = await pdf.embedPng(Buffer.from(b64, "base64"));
        images.set(f.value, img);
      }
      const scale = Math.min(bw / img.width, bh / img.height);
      const rw = img.width * scale, rh = img.height * scale;
      const rx = bx, ry = by + (bh - rh) / 2;
      const a = g.map(rx, ry + rh);
      page.drawImage(img, { x: a.x, y: a.y, width: rw, height: rh, rotate: degrees(g.r) });
    } else {
      const text = safeText(font, f.value);
      const size = fitSize(font, text, bw - 4, bh);
      const a = g.map(bx + 2, by + bh / 2 + size * 0.35);
      page.drawText(text, { x: a.x, y: a.y, size, font, color: ink, rotate: degrees(g.r) });
    }
  }

  // Signature certificate
  const page = pdf.addPage([595.28, 841.89]);
  const M = 50;
  let y = 841.89 - 60;
  const muted = rgb(0.37, 0.4, 0.5), dark = rgb(0.08, 0.1, 0.18), line = rgb(0.87, 0.89, 0.92);
  const text = (t: string, x: number, size = 9.5, f = font, color = dark) => page.drawText(safeText(f, t), { x, y, size, font: f, color });
  const fit = (v: string, size: number, maxW: number) => {
    let t = safeText(font, v);
    if (font.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
    return t + "...";
  };
  const row = (k: string, v: string) => { text(k, M, 9, font, muted); text(fit(v, 9.5, 595.28 - M * 2 - 120), M + 120, 9.5); y -= 16; };

  text("Signature certificate", M, 20, bold); y -= 18;
  text("FYNE EDGE Ops · electronic signature record", M, 10, font, muted); y -= 30;
  row("Document", audit.title);
  row("File", audit.fileName);
  row("Document ID", audit.documentId);
  row("Pages", `${audit.pageCount} (plus this certificate)`);
  row("Original SHA-256", audit.originalSha256);
  row("Created by", `${audit.createdBy}, ${fmtTime(audit.createdAt)}`);
  row("Sent for signing", fmtTime(audit.sentAt));
  row("Completed", fmtTime(audit.completedAt));
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: 595.28 - M, y }, thickness: 0.8, color: line }); y -= 24;
  text(`Signers (${audit.signers.length})`, M, 12, bold); y -= 22;

  for (const s of audit.signers) {
    if (y < 140) break;
    const top = y;
    text(s.name, M, 11, bold); y -= 15;
    text(s.email, M, 9, font, muted); y -= 15;
    row("Signed", fmtTime(s.signedAt));
    row("IP address", s.ip || "—");
    row("Device", s.userAgent || "—");
    if (s.signature) {
      try {
        const img = images.get(s.signature) ?? await pdf.embedPng(Buffer.from(s.signature.replace(/^data:image\/png;base64,/, ""), "base64"));
        const scale = Math.min(150 / img.width, 44 / img.height);
        page.drawImage(img, { x: 595.28 - M - img.width * scale, y: top - 40, width: img.width * scale, height: img.height * scale });
      } catch { /* signature image is optional on the certificate */ }
    }
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: 595.28 - M, y }, thickness: 0.5, color: line }); y -= 20;
  }

  y = 60;
  text("Each signer signed in to FYNE EDGE Ops with their own account and agreed that their electronic signature", M, 8, font, muted); y -= 11;
  text("is the legal equivalent of their handwritten signature. Times are recorded by the server.", M, 8, font, muted);

  pdf.setTitle(audit.title);
  pdf.setProducer("FYNE EDGE Ops");
  pdf.setModificationDate(audit.completedAt);
  return pdf.save();
}
