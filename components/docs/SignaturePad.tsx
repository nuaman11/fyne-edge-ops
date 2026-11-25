"use client";

import { useEffect, useRef, useState } from "react";

const FONT = "Dancing Script";
const STORE = (uid: string, kind: string) => `fyne-sig-${kind}-${uid}`;

/** Trims transparent edges so the signature fills its box. */
function trimmed(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext("2d")!;
  const { width, height } = c;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3]! > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** Window for drawing or typing a signature (or initials). Returns a PNG data URL. */
export function SignaturePad({ kind, name, userId, onDone, onClose }: {
  kind: "SIGNATURE" | "INITIALS"; name: string; userId: string;
  onDone: (png: string, applyToAll: boolean) => void; onClose: () => void;
}) {
  const word = kind === "INITIALS" ? "initials" : "signature";
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join("").slice(0, 3);
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(kind === "INITIALS" ? initials : name);
  const [hasInk, setHasInk] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const draw = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => { try { setSaved(localStorage.getItem(STORE(userId, kind))); } catch { /* storage blocked */ } }, [userId, kind]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  // Drawing
  useEffect(() => {
    if (tab !== "draw") return;
    const c = draw.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#101a52"; ctx.lineWidth = 2.4;
    let last: { x: number; y: number } | null = null;
    const pos = (e: PointerEvent) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const down = (e: PointerEvent) => { e.preventDefault(); c.setPointerCapture(e.pointerId); last = pos(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = "#101a52"; ctx.fill(); setHasInk(true); };
    const move = (e: PointerEvent) => { if (!last) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; };
    const up = () => { last = null; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); c.removeEventListener("pointercancel", up); };
  }, [tab]);

  // Typed preview
  useEffect(() => {
    if (tab !== "type") return;
    let off = false;
    (async () => {
      try { await document.fonts.load(`64px "${FONT}"`); } catch { /* falls back to a system script font */ }
      const c = preview.current;
      if (!c || off) return;
      c.width = 900; c.height = 220;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#101a52"; ctx.textBaseline = "middle";
      let size = 110;
      do { ctx.font = `${size}px "${FONT}", "Segoe Script", "Snell Roundhand", cursive`; size -= 4; } while (ctx.measureText(typed).width > c.width - 40 && size > 30);
      ctx.fillText(typed, 20, c.height / 2);
    })();
    return () => { off = true; };
  }, [tab, typed]);

  function clear() {
    const c = draw.current; if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasInk(false);
  }
  function finish(png: string | null) {
    if (!png) return;
    if (remember) { try { localStorage.setItem(STORE(userId, kind), png); } catch { /* storage blocked */ } }
    onDone(png, applyAll);
  }
  const ready = tab === "draw" ? hasInk : !!typed.trim();

  return (
    <div className="scrim open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${FONT.replace(" ", "+")}:wght@600&display=swap`} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Add your ${word}`}>
        <div className="mhead"><h2>Add your {word}</h2><button type="button" className="x" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="mbody"><div className="mmain">
          {saved ? (
            <button type="button" className="saved-sig" onClick={() => onDone(saved, applyAll)}>
              <img src={saved} alt={`Your saved ${word}`} /><span>Use my saved {word}</span>
            </button>
          ) : null}
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "draw"} className={tab === "draw" ? "on" : ""} onClick={() => setTab("draw")}>Draw</button>
            <button type="button" role="tab" aria-selected={tab === "type"} className={tab === "type" ? "on" : ""} onClick={() => setTab("type")}>Type</button>
          </div>
          {tab === "draw" ? (
            <div className="sigpad">
              <canvas ref={draw} aria-label={`Draw your ${word} here`} />
              <span className="sigline" />
              {!hasInk ? <span className="sighint">Draw your {word} here</span> : <button type="button" className="btn sm ghost sigclear" onClick={clear}>Clear</button>}
            </div>
          ) : (
            <div className="form" style={{ gridTemplateColumns: "1fr" }}>
              <div className="f"><label className="l" htmlFor="sig-typed">Type your {kind === "INITIALS" ? "initials" : "full name"}</label>
                <input id="sig-typed" type="text" value={typed} maxLength={kind === "INITIALS" ? 4 : 60} onChange={(e) => setTyped(e.target.value)} /></div>
              <div className="sigpad typed"><canvas ref={preview} aria-label="Preview" /></div>
            </div>
          )}
          <label className="chk"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} /> Use it for all my {word} boxes in this document</label>
          <label className="chk"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember it on this device</label>
        </div></div>
        <div className="mfoot"><div className="r">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={!ready} onClick={() => finish(tab === "draw" ? trimmed(draw.current!) : trimmed(preview.current!))}>Adopt {word}</button>
        </div></div>
      </div>
    </div>
  );
}
