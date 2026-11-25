import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, documents, documentSigners } from "@/lib/db";
import { canManageDoc } from "@/lib/documents";
import { readStored } from "@/lib/storage";

/** Streams a document's PDF to someone allowed to see it. Files are never served straight from storage. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { id } = await params;
  const [d] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!d) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canManageDoc(me, d)) {
    const [s] = await db.select({ id: documentSigners.id }).from(documentSigners).where(and(eq(documentSigners.documentId, id), eq(documentSigners.userId, me.id))).limit(1);
    if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = new URL(request.url);
  const signed = url.searchParams.get("kind") === "signed";
  const path = signed ? d.signedPath : d.filePath;
  if (!path) return NextResponse.json({ error: "The signed PDF isn't ready yet." }, { status: 404 });
  let bytes: Uint8Array;
  try { bytes = await readStored(path); } catch { return NextResponse.json({ error: "The file couldn't be read from storage." }, { status: 502 }); }
  const base = d.fileName.replace(/\.pdf$/i, "");
  const name = `${base}${signed ? " (signed)" : ""}.pdf`.replace(/["\\\r\n]/g, "");
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
