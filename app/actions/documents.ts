"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db, documents, documentSigners, documentFields, documentEvents, users, clients } from "@/lib/db";
import { actor, AppError, run, reqStr, optStr, optId, type ActionResult } from "@/lib/action";
import { canManageDoc, requestMeta } from "@/lib/documents";
import { deleteStored, isOwnUploadPath, readStored, sha256, storageMode, writeStored } from "@/lib/storage";
import { inspectPdf, stampDocument } from "@/lib/pdf-sign";
import { fmtDate, todayISO } from "@/lib/format";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const log = (tx: Tx | typeof db, documentId: string, actorId: string | null, detail: string, ip: string | null = null) =>
  tx.insert(documentEvents).values({ documentId, actorId, detail, ip });

async function loadManaged(id: string) {
  const me = await actor();
  const [d] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!d) throw new AppError("Document not found. It may have been deleted.");
  if (!canManageDoc(me, d)) throw new AppError("Only the person who created this document, or an admin, can do this.");
  return { me, d };
}

const done = (id?: string) => {
  revalidatePath("/documents", "layout");
  revalidatePath("/", "layout");
  return id ? { ok: true as const, id } : { ok: true as const };
};

/* ---------- create ---------- */

const createSchema = z.object({
  title: reqStr("Title", 200),
  path: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  clientId: optId,
});

/** Registers an uploaded PDF as a new draft. */
export async function createDocument(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    if (storageMode() === "missing") throw new AppError("File storage isn't connected yet. An admin needs to connect Vercel Blob storage.");
    const v = createSchema.parse(input);
    if (!isOwnUploadPath(v.path, me.id)) throw new AppError("That upload isn't yours. Upload the file again.");
    let bytes: Uint8Array;
    try { bytes = await readStored(v.path); } catch { throw new AppError("The upload didn't finish. Try uploading the PDF again."); }
    let pageCount: number;
    try { ({ pageCount } = await inspectPdf(bytes)); } catch (e) {
      await deleteStored(v.path);
      throw new AppError(e instanceof Error ? e.message : "This file isn't a readable PDF.");
    }
    if (v.clientId) {
      const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, v.clientId)).limit(1);
      if (!c) v.clientId = null;
    }
    const { ip } = await requestMeta();
    const id = await db.transaction(async (tx) => {
      const [d] = await tx.insert(documents).values({
        title: v.title, clientId: v.clientId, fileName: v.fileName, filePath: v.path, fileSize: bytes.byteLength,
        fileSha256: sha256(bytes), pageCount, createdById: me.id,
      }).returning({ id: documents.id });
      await log(tx, d!.id, me.id, `uploaded ${v.fileName}`, ip);
      return d!.id;
    });
    return done(id);
  });
}

/* ---------- set up (draft only) ---------- */

const fieldSchema = z.object({
  signerUserId: z.string().min(1),
  type: z.enum(["SIGNATURE", "INITIALS", "DATE", "NAME", "TEXT"]),
  page: z.number().int().min(1),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  w: z.number().min(0.005).max(1), h: z.number().min(0.005).max(1),
  required: z.boolean().default(true),
  label: optStr(80),
});
const setupSchema = z.object({
  title: reqStr("Title", 200),
  message: optStr(2000),
  clientId: optId,
  signerUserIds: z.array(z.string().min(1)).max(20),
  fields: z.array(fieldSchema).max(500),
});

/** Saves title, signers and field boxes on a draft. */
export async function saveDocumentSetup(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { me, d } = await loadManaged(id);
    if (d.status !== "DRAFT") throw new AppError("This document has already been sent, so it can't be changed. Duplicate it to make a new version.");
    const v = setupSchema.parse(input);
    const signerIds = [...new Set(v.signerUserIds)];
    const people = signerIds.length ? await db.select().from(users).where(inArray(users.id, signerIds)) : [];
    if (people.length !== signerIds.length || people.some((p) => !p.active)) throw new AppError("One of the signers no longer has an active account. Remove them and try again.");
    for (const f of v.fields) {
      if (!signerIds.includes(f.signerUserId)) throw new AppError("A field belongs to someone who isn't a signer. Assign it to a signer or delete it.");
      if (f.page > d.pageCount) throw new AppError("A field is on a page that doesn't exist.");
      if (f.x + f.w > 1.001 || f.y + f.h > 1.001) throw new AppError("A field sticks out past the edge of the page. Move it inside the page.");
    }
    await db.transaction(async (tx) => {
      await tx.update(documents).set({ title: v.title, message: v.message, clientId: v.clientId }).where(eq(documents.id, id));
      await tx.delete(documentSigners).where(eq(documentSigners.documentId, id));
      const idByUser = new Map<string, string>();
      for (const userId of signerIds) {
        const p = people.find((x) => x.id === userId)!;
        const [s] = await tx.insert(documentSigners).values({ documentId: id, userId, name: p.name, email: p.email }).returning({ id: documentSigners.id });
        idByUser.set(userId, s!.id);
      }
      if (v.fields.length) {
        await tx.insert(documentFields).values(v.fields.map((f) => ({
          documentId: id, signerId: idByUser.get(f.signerUserId)!, type: f.type, page: f.page,
          x: f.x, y: f.y, w: Math.min(f.w, 1 - f.x), h: Math.min(f.h, 1 - f.y),
          required: f.type === "SIGNATURE" || f.type === "INITIALS" || f.type === "DATE" || f.type === "NAME" ? true : f.required,
          label: f.type === "TEXT" ? f.label : null,
        })));
      }
    });
    void me;
    return done(id);
  });
}

/** Sends a draft for signing. Every signer needs at least one signature box. */
export async function sendDocument(id: string): Promise<ActionResult> {
  return run(async () => {
    const { me, d } = await loadManaged(id);
    if (d.status !== "DRAFT") throw new AppError("This document has already been sent.");
    const signers = await db.select().from(documentSigners).where(eq(documentSigners.documentId, id));
    if (!signers.length) throw new AppError("Add at least one signer before sending.");
    const fields = await db.select({ signerId: documentFields.signerId, type: documentFields.type }).from(documentFields).where(eq(documentFields.documentId, id));
    const missing = signers.filter((s) => !fields.some((f) => f.signerId === s.id && f.type === "SIGNATURE"));
    if (missing.length) throw new AppError(`Add a signature box for ${missing.map((s) => s.name).join(", ")} before sending.`);
    const { ip } = await requestMeta();
    await db.transaction(async (tx) => {
      const r = await tx.update(documents).set({ status: "OUT_FOR_SIGNATURE", sentAt: new Date() })
        .where(and(eq(documents.id, id), eq(documents.status, "DRAFT"))).returning({ id: documents.id });
      if (!r.length) throw new AppError("This document has already been sent.");
      await log(tx, id, me.id, `sent it for signing to ${signers.map((s) => s.name).join(", ")}`, ip);
    });
    return done(id);
  });
}

/* ---------- signing ---------- */

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const signSchema = z.object({
  values: z.array(z.object({ fieldId: z.string().min(1), value: z.string().max(400_000).nullable() })).max(500),
  agreed: z.literal(true, { error: "Tick the box to agree to sign electronically." }),
});

function isPng(dataUrl: string) {
  if (!PNG_DATA_URL.test(dataUrl)) return false;
  const head = Buffer.from(dataUrl.slice(22, 40), "base64");
  return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
}

/** The signed-in signer fills their boxes and signs. When the last person signs, the signed PDF is produced. */
export async function signDocument(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const v = signSchema.parse(input);
    const [d] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!d) throw new AppError("Document not found. It may have been deleted.");
    if (d.status !== "OUT_FOR_SIGNATURE") throw new AppError(d.status === "VOIDED" ? "This document was voided, so it can't be signed." : "This document isn't waiting for signatures.");
    const [signer] = await db.select().from(documentSigners).where(and(eq(documentSigners.documentId, id), eq(documentSigners.userId, me.id))).limit(1);
    if (!signer) throw new AppError("You're not a signer on this document.");
    if (signer.status !== "PENDING") throw new AppError("You've already responded to this document.");
    const mine = await db.select().from(documentFields).where(and(eq(documentFields.documentId, id), eq(documentFields.signerId, signer.id)));
    const given = new Map(v.values.map((x) => [x.fieldId, x.value]));
    const now = new Date();
    const filled: { id: string; value: string | null }[] = [];
    for (const f of mine) {
      let value: string | null = null;
      if (f.type === "DATE") value = fmtDate(todayISO(), true);
      else if (f.type === "NAME") value = signer.name;
      else {
        const raw = given.get(f.id);
        value = raw ? raw.trim() : null;
        if (value && (f.type === "SIGNATURE" || f.type === "INITIALS") && !isPng(value)) throw new AppError("A signature couldn't be read. Draw or type it again.");
        if (value && f.type === "TEXT") value = value.slice(0, 500);
      }
      if (f.required && !value) throw new AppError(f.type === "TEXT" ? `Fill in “${f.label || "Text"}” before signing.` : "Fill in every highlighted box before signing.");
      filled.push({ id: f.id, value });
    }
    const { ip, userAgent } = await requestMeta();
    await db.transaction(async (tx) => {
      const r = await tx.update(documentSigners).set({ status: "SIGNED", signedAt: now, ip, userAgent })
        .where(and(eq(documentSigners.id, signer.id), eq(documentSigners.status, "PENDING"))).returning({ id: documentSigners.id });
      if (!r.length) throw new AppError("You've already responded to this document.");
      for (const f of filled) await tx.update(documentFields).set({ value: f.value, filledAt: f.value ? now : null }).where(eq(documentFields.id, f.id));
      await log(tx, id, me.id, "signed the document", ip);
    });
    const [left] = await db.select({ n: count() }).from(documentSigners).where(and(eq(documentSigners.documentId, id), ne(documentSigners.status, "SIGNED")));
    if (left!.n === 0) {
      try { await finalize(id); } catch (e) { console.error("Finalizing document failed", id, e); }
    }
    return done(id);
  });
}

/** Builds the signed PDF with the certificate page and marks the document completed. Safe to call twice. */
async function finalize(id: string) {
  const [d] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!d || d.status !== "OUT_FOR_SIGNATURE") return;
  const signers = await db.select().from(documentSigners).where(eq(documentSigners.documentId, id));
  if (!signers.length || signers.some((s) => s.status !== "SIGNED")) return;
  const fields = await db.select().from(documentFields).where(eq(documentFields.documentId, id));
  const [creator] = d.createdById ? await db.select({ name: users.name }).from(users).where(eq(users.id, d.createdById)).limit(1) : [];
  const original = await readStored(d.filePath);
  const completedAt = new Date();
  const bytes = await stampDocument(original, fields.map((f) => ({ type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, value: f.value })), {
    documentId: d.id, title: d.title, fileName: d.fileName, pageCount: d.pageCount, originalSha256: d.fileSha256,
    createdBy: creator?.name ?? "Former user", createdAt: d.createdAt, sentAt: d.sentAt, completedAt,
    signers: signers.sort((a, b) => (a.signedAt?.getTime() ?? 0) - (b.signedAt?.getTime() ?? 0)).map((s) => ({
      name: s.name, email: s.email, signedAt: s.signedAt, ip: s.ip, userAgent: s.userAgent,
      signature: fields.find((f) => f.signerId === s.id && f.type === "SIGNATURE" && f.value)?.value ?? null,
    })),
  });
  const base = d.fileName.replace(/\.pdf$/i, "").replace(/[^\w\-]+/g, "-").slice(0, 60) || "document";
  const path = await writeStored(`documents/${d.createdById ?? "system"}/${base}-signed.pdf`, bytes);
  const r = await db.update(documents).set({ status: "COMPLETED", completedAt, signedPath: path, signedSha256: sha256(bytes) })
    .where(and(eq(documents.id, id), eq(documents.status, "OUT_FOR_SIGNATURE"))).returning({ id: documents.id });
  if (!r.length) { await deleteStored(path); return; }
  await log(db, id, null, "All signers signed. The signed PDF with its signature certificate was created.");
}

/** Retry producing the signed PDF if it failed the first time. */
export async function finalizeDocument(id: string): Promise<ActionResult> {
  return run(async () => {
    await loadManaged(id);
    try { await finalize(id); } catch (e) { console.error(e); throw new AppError("Couldn't create the signed PDF. Try again in a minute."); }
    return done(id);
  });
}

/** A signer refuses to sign. The document is voided so the sender can fix it and send a new version. */
export async function declineDocument(id: string, reason: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const why = reqStr("Reason", 500).parse(reason);
    const [signer] = await db.select().from(documentSigners).where(and(eq(documentSigners.documentId, id), eq(documentSigners.userId, me.id))).limit(1);
    if (!signer) throw new AppError("You're not a signer on this document.");
    const { ip } = await requestMeta();
    await db.transaction(async (tx) => {
      const r = await tx.update(documentSigners).set({ status: "DECLINED", declinedAt: new Date(), declineReason: why, ip })
        .where(and(eq(documentSigners.id, signer.id), eq(documentSigners.status, "PENDING"))).returning({ id: documentSigners.id });
      if (!r.length) throw new AppError("You've already responded to this document.");
      const v = await tx.update(documents).set({ status: "VOIDED", voidedAt: new Date(), voidReason: `Declined by ${signer.name}: ${why}` })
        .where(and(eq(documents.id, id), eq(documents.status, "OUT_FOR_SIGNATURE"))).returning({ id: documents.id });
      if (!v.length) throw new AppError("This document isn't waiting for signatures any more.");
      await log(tx, id, me.id, `declined to sign: ${why}`, ip);
    });
    return done(id);
  });
}

/** The sender (or an admin) cancels a document that is out for signature. */
export async function voidDocument(id: string, reason: unknown): Promise<ActionResult> {
  return run(async () => {
    const { me, d } = await loadManaged(id);
    if (d.status !== "OUT_FOR_SIGNATURE") throw new AppError("Only documents that are out for signature can be voided.");
    const why = reqStr("Reason", 500).parse(reason);
    const { ip } = await requestMeta();
    await db.transaction(async (tx) => {
      await tx.update(documents).set({ status: "VOIDED", voidedAt: new Date(), voidReason: why }).where(eq(documents.id, id));
      await log(tx, id, me.id, `voided the document: ${why}`, ip);
    });
    return done(id);
  });
}

/** Copies a document (same PDF, signers and boxes, no signatures) into a new draft. */
export async function duplicateDocument(id: string): Promise<ActionResult> {
  return run(async () => {
    const { me, d } = await loadManaged(id);
    const signers = await db.select().from(documentSigners).where(eq(documentSigners.documentId, id));
    const fields = await db.select().from(documentFields).where(eq(documentFields.documentId, id));
    const active = signers.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
      .where(and(inArray(users.id, signers.map((s) => s.userId).filter((x): x is string => !!x)), eq(users.active, true))) : [];
    const { ip } = await requestMeta();
    const newId = await db.transaction(async (tx) => {
      const [nd] = await tx.insert(documents).values({
        title: d.title.startsWith("Copy of ") ? d.title : `Copy of ${d.title}`, message: d.message, clientId: d.clientId,
        fileName: d.fileName, filePath: d.filePath, fileSize: d.fileSize, fileSha256: d.fileSha256, pageCount: d.pageCount, createdById: me.id,
      }).returning({ id: documents.id });
      const map = new Map<string, string>();
      for (const s of signers) {
        const u = active.find((a) => a.id === s.userId);
        if (!u) continue;
        const [ns] = await tx.insert(documentSigners).values({ documentId: nd!.id, userId: u.id, name: u.name, email: u.email }).returning({ id: documentSigners.id });
        map.set(s.id, ns!.id);
      }
      const keep = fields.filter((f) => map.has(f.signerId));
      if (keep.length) await tx.insert(documentFields).values(keep.map((f) => ({
        documentId: nd!.id, signerId: map.get(f.signerId)!, type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, required: f.required, label: f.label,
      })));
      await log(tx, nd!.id, me.id, `created this draft as a copy of “${d.title}”`, ip);
      return nd!.id;
    });
    return done(newId);
  });
}

/** Deletes a draft or a voided document. Completed documents are kept as records. */
export async function deleteDocument(id: string): Promise<ActionResult> {
  return run(async () => {
    const { me, d } = await loadManaged(id);
    if (d.status === "OUT_FOR_SIGNATURE") throw new AppError("Void this document before deleting it.");
    if (d.status === "COMPLETED" && me.role !== "ADMIN") throw new AppError("Signed documents are kept as records. Only an admin can delete one.");
    if (d.status === "VOIDED" && me.role !== "ADMIN" && d.createdById !== me.id) throw new AppError("Only the sender or an admin can delete this.");
    await db.delete(documents).where(eq(documents.id, id));
    const [others] = await db.select({ n: count() }).from(documents).where(eq(documents.filePath, d.filePath));
    if (!others!.n) await deleteStored(d.filePath);
    if (d.signedPath) await deleteStored(d.signedPath);
    return done();
  });
}
