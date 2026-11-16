"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchEverything, type SearchHit } from "@/app/actions/search";
import { Icon } from "@/components/ui";

/** Search box in the top bar: tickets, clients, leads and people. Press / or Ctrl+K to jump to it. */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if (document.querySelector(".scrim.open")) return;
      if (!typing && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try { const r = await searchEverything(term); if (my === seq.current) { setHits(r); setSel(0); } } catch { if (my === seq.current) setHits([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(h: SearchHit | undefined) {
    if (!h) return;
    setOpen(false); setQ(""); setHits(null); input.current?.blur();
    router.push(h.href);
  }

  let lastGroup = "";
  return (
    <div className="search">
      <Icon name="search" />
      <input ref={input} type="search" placeholder="Search tickets, clients, leads and people" aria-label="Search" value={q} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!hits?.length) { if (e.key === "Escape") input.current?.blur(); return; }
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % hits.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + hits.length) % hits.length); }
          else if (e.key === "Enter") { e.preventDefault(); go(hits[sel]); }
          else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
        }} />
      <kbd>/</kbd>
      {open && q.trim() && hits ? (
        <div className="qres" role="listbox">
          {hits.length ? hits.map((h, i) => {
            const head = h.group !== lastGroup ? <div className="g">{h.group}</div> : null;
            lastGroup = h.group;
            return (
              <div key={h.group + h.href}>
                {head}
                <div role="option" aria-selected={i === sel} className={`it ${i === sel ? "on" : ""}`} onMouseDown={(e) => { e.preventDefault(); go(h); }} onMouseEnter={() => setSel(i)}>
                  <b>{h.title}</b><span>{h.sub}</span>
                </div>
              </div>
            );
          }) : <div className="none">Nothing matches “{q.trim()}”. Search looks at ticket titles and numbers, client and lead names and contacts, and people.</div>}
        </div>
      ) : null}
    </div>
  );
}
