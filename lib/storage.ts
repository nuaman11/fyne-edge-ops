import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * Where document files live.
 * - "blob": private Vercel Blob storage (production). Needs BLOB_READ_WRITE_TOKEN, which Vercel sets when you connect a Blob store.
 * - "local": a folder on disk, only for running the app on your own computer.
 * - "missing": deployed without Blob storage connected; uploads are switched off until it is.
 */
export type StorageMode = "blob" | "local" | "missing";

export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL || (process.env.NODE_ENV === "production" && !process.env.LOCAL_STORAGE_DIR)) return "missing";
  return "local";
}

const localRoot = () => path.resolve(process.env.LOCAL_STORAGE_DIR || ".local-storage");
function localPath(p: string) {
  const full = path.resolve(localRoot(), p);
  if (!full.startsWith(localRoot() + path.sep)) throw new Error("Invalid file path.");
  return full;
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Only paths the app itself hands out are accepted: documents/<user id>/<name>.pdf */
export function isOwnUploadPath(p: string, userId: string) {
  return p.startsWith(`documents/${userId}/`) && /^[\w\-./]+\.pdf$/i.test(p) && !p.includes("..");
}

export async function readStored(p: string): Promise<Uint8Array> {
  const mode = storageMode();
  if (mode === "local") return new Uint8Array(await readFile(localPath(p)));
  if (mode === "missing") throw new Error("File storage isn't connected.");
  const r = await get(p, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) throw new Error("File not found in storage.");
  return new Uint8Array(await new Response(r.stream).arrayBuffer());
}

/** Saves bytes and returns the stored path (Blob adds a random suffix so names never collide). */
export async function writeStored(p: string, bytes: Uint8Array, contentType = "application/pdf"): Promise<string> {
  const mode = storageMode();
  if (mode === "local") {
    const full = localPath(p);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return p;
  }
  if (mode === "missing") throw new Error("File storage isn't connected.");
  const r = await put(p, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: true });
  return r.pathname;
}

export async function deleteStored(p: string) {
  const mode = storageMode();
  try {
    if (mode === "local") await rm(localPath(p), { force: true });
    else if (mode === "blob") await del(p);
  } catch (e) {
    console.error("Couldn't delete stored file", p, e);
  }
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
