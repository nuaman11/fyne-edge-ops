"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Company logo. Put your file at public/logo.png (or change LOGO_SRC).
 * If the file is missing, it falls back to the "FE" mark and name.
 */
const LOGO_SRC = "/logo.png";

export function Logo({ variant = "rail" }: { variant?: "rail" | "auth" }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Catch a load error that happened before the page became interactive.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return variant === "rail" ? (
      <div className="brand"><span className="mark">FE</span><div><b>FYNE EDGE</b><small>Operations</small></div></div>
    ) : (
      <div className="mark">FE</div>
    );
  }

  return (
    <div className={variant === "rail" ? "brand brand-logo" : "auth-logo"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={LOGO_SRC} alt="FYNE EDGE" onError={() => setFailed(true)} />
    </div>
  );
}
