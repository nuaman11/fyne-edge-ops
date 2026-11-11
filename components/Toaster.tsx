"use client";

import { useEffect, useState } from "react";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("fe-toast", { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const h = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setMsg(null), 3500); };
    window.addEventListener("fe-toast", h);
    return () => { window.removeEventListener("fe-toast", h); clearTimeout(t); };
  }, []);
  return <div className={`toast ${msg ? "show" : ""}`} role="status" aria-live="polite">{msg}</div>;
}
