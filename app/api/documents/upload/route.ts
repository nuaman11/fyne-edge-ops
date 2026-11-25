import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { MAX_PDF_BYTES, isOwnUploadPath, storageMode, writeStored } from "@/lib/storage";

/**
 * Upload a PDF for signing.
 * - With Vercel Blob: the browser asks this route for a short-lived upload token, then sends the file straight to private Blob storage.
 * - Running locally: the browser posts the file here and it is saved to a folder on disk.
 */
export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Your session has ended. Sign in again." }, { status: 401 });
  const mode = storageMode();

  if (mode === "blob") {
    try {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          if (!isOwnUploadPath(pathname, me.id)) throw new Error("Invalid upload path.");
          return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_PDF_BYTES, addRandomSuffix: true };
        },
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 400 });
    }
  }

  if (mode === "local") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });
    if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "The PDF is larger than 25 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const p = await writeStored(`documents/${me.id}/${crypto.randomUUID()}.pdf`, bytes);
    return NextResponse.json({ pathname: p });
  }

  return NextResponse.json({ error: "File storage isn't connected yet. An admin needs to connect Vercel Blob storage." }, { status: 503 });
}
