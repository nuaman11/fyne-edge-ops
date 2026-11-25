"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PageSize = { w: number; h: number };

/** Each open PDF gets its own worker, so leaving one page never breaks the viewer on the next. */
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

/**
 * Renders every page of a PDF, full width, with an overlay layer per page.
 * Overlay children are positioned in % of the page, so boxes stay put at any screen size.
 */
export function PdfPages({ src, overlay, onSizes, onPageClick }: {
  src: string;
  overlay?: (page: number, size: PageSize) => React.ReactNode;
  onSizes?: (sizes: PageSize[]) => void;
  /** Click on empty page area: page number and position as fractions of the page. */
  onPageClick?: (page: number, x: number, y: number) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setDoc(null); setSizes([]); setError(null);
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const res = await fetch(src, { credentials: "same-origin" });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "The PDF couldn't be loaded.");
        const data = new Uint8Array(await res.arrayBuffer());
        const t = pdfjs.getDocument({ data });
        task = t;
        const loaded = await t.promise;
        const s: PageSize[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const vp = (await loaded.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        setSizes(s); setDoc(loaded); onSizes?.(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "The PDF couldn't be loaded.");
      }
    })();
    return () => { cancelled = true; void task?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (error) return <div className="notice"><span>{error}</span></div>;
  if (!doc) return <div className="pdf-loading">Loading the PDF…</div>;
  return (
    <div className="pdf">
      {sizes.map((size, i) => (
        <PdfPage key={i} doc={doc} page={i + 1} size={size} overlay={overlay} onPageClick={onPageClick} total={sizes.length} />
      ))}
    </div>
  );
}

function PdfPage({ doc, page, size, overlay, onPageClick, total }: {
  doc: PDFDocumentProxy; page: number; size: PageSize; total: number;
  overlay?: (page: number, size: PageSize) => React.ReactNode;
  onPageClick?: (page: number, x: number, y: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(page <= 2);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setVisible(true); }, { rootMargin: "800px 0px" });
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e?.contentRect.width ?? 0)));
    io.observe(el); ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, []);

  useEffect(() => {
    if (!visible || !width || !canvas.current) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    (async () => {
      const p = await doc.getPage(page);
      if (cancelled || !canvas.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: (width / size.w) * dpr });
      const c = canvas.current;
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      task = p.render({ canvas: c, viewport: vp });
      try { await task.promise; } catch { /* re-render cancelled */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [visible, width, doc, page, size.w]);

  return (
    <div className="pdf-page" ref={wrap} style={{ aspectRatio: `${size.w} / ${size.h}` }} data-page={page}
      onPointerDown={(e) => {
        if (!onPageClick || e.target !== e.currentTarget.querySelector(".pdf-overlay")) return;
        const r = e.currentTarget.getBoundingClientRect();
        onPageClick(page, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }}>
      <canvas ref={canvas} aria-label={`Page ${page} of ${total}`} />
      <div className="pdf-overlay">{overlay?.(page, size)}</div>
      <span className="pdf-num">{page} / {total}</span>
    </div>
  );
}
