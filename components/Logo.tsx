"use client";

import { useEffect, useRef, useState } from "react";

/**
 * FYNE EDGE logo (icon + wordmark).
 *  - public/brand/logo-light.png  white text, for dark backgrounds
 * Falls back to the "FE" mark if the files are missing.
 */
const LIGHT_TEXT = "/brand/logo-light.png";

export function Logo({ variant = "rail" }: { variant?: "rail" | "auth" }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
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

  if (variant === "auth") {
    // Sign-in panel has a blue background: always use the white-text logo.
    return (
      <div className="auth-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={LIGHT_TEXT} alt="FYNE EDGE" onError={() => setFailed(true)} />
      </div>
    );
  }

  // The app uses the website's dark look everywhere, so the white-text logo is always used.
  return (
    <div className="brand brand-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={LIGHT_TEXT} alt="FYNE EDGE" onError={() => setFailed(true)} />
    </div>
  );
}
