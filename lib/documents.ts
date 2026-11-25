import "server-only";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db, documents, documentSigners, documentFields, documentEvents } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import type { DocDetail, DocListRow } from "@/lib/types";

export function canManageDoc(me: Pick<SessionUser, "id" | "role">, doc: { createdById: string | null }) {
  return me.role === "ADMIN" || doc.createdById === me.id;
}

/** Documents this person may see: admins see all; others see ones they created or must sign. */
export async function listDocumentsFor(me: Pick<SessionUser, "id" | "role">): Promise<DocListRow[]> {
  let ids: string[] | null = null;
  if (me.role !== "ADMIN") {
    const mine = await db.select({ id: documentSigners.documentId }).from(documentSigners).where(eq(documentSigners.userId, me.id));
    ids = mine.map((m) => m.id);
  }
  const rows = await db.select().from(documents)
    .where(ids === null ? undefined : ids.length ? or(eq(documents.createdById, me.id), inArray(documents.id, ids)) : eq(documents.createdById, me.id))
    .orderBy(desc(documents.updatedAt));
  if (!rows.length) return [];
  const signers = await db.select({ documentId: documentSigners.documentId, userId: documentSigners.userId, name: documentSigners.name, status: documentSigners.status })
    .from(documentSigners).where(inArray(documentSigners.documentId, rows.map((r) => r.id))).orderBy(asc(documentSigners.createdAt));
  return rows.map((d) => ({
    id: d.id, title: d.title, status: d.status, clientId: d.clientId, createdById: d.createdById,
    createdAt: d.createdAt.toISOString(), sentAt: d.sentAt?.toISOString() ?? null, completedAt: d.completedAt?.toISOString() ?? null,
    signers: signers.filter((s) => s.documentId === d.id).map(({ userId, name, status }) => ({ userId, name, status })),
  }));
}

/** Full document for someone allowed to see it, or null. */
export async function getDocumentFor(me: Pick<SessionUser, "id" | "role">, id: string): Promise<DocDetail | null> {
  const [d] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!d) return null;
  const [signers, fields, events] = await Promise.all([
    db.select().from(documentSigners).where(eq(documentSigners.documentId, id)).orderBy(asc(documentSigners.createdAt)),
    db.select().from(documentFields).where(eq(documentFields.documentId, id)),
    db.select().from(documentEvents).where(eq(documentEvents.documentId, id)).orderBy(asc(documentEvents.createdAt)),
  ]);
  if (!(canManageDoc(me, d) || signers.some((s) => s.userId === me.id))) return null;
  return {
    id: d.id, title: d.title, status: d.status, clientId: d.clientId, createdById: d.createdById,
    createdAt: d.createdAt.toISOString(), sentAt: d.sentAt?.toISOString() ?? null, completedAt: d.completedAt?.toISOString() ?? null,
    message: d.message, fileName: d.fileName, fileSize: d.fileSize, fileSha256: d.fileSha256, pageCount: d.pageCount,
    hasSignedFile: !!d.signedPath, signedSha256: d.signedSha256, voidedAt: d.voidedAt?.toISOString() ?? null, voidReason: d.voidReason,
    signers: signers.map((s) => ({
      id: s.id, userId: s.userId, name: s.name, email: s.email, status: s.status,
      signedAt: s.signedAt?.toISOString() ?? null, declinedAt: s.declinedAt?.toISOString() ?? null, declineReason: s.declineReason,
    })),
    fields: fields.map((f) => ({ id: f.id, signerId: f.signerId, type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, required: f.required, label: f.label, value: f.value })),
    events: events.map((e) => ({ id: e.id, actorId: e.actorId, detail: e.detail, createdAt: e.createdAt.toISOString() })),
  };
}

/** Caller's IP and browser, for the audit trail. */
export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0]!.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  return { ip, userAgent: ua ? ua.slice(0, 300) : null };
}
