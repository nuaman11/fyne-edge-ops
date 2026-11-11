"use client";

import { useEffect, useRef, useState } from "react";

/**
 * FYNE EDGE logo (icon + wordmark).
 *  - public/brand/logo-light.png  white text, for dark backgrounds
 *  - public/brand/logo-dark.png   dark text, for light backgrounds
 * Falls back to the "FE" mark if the files are missing.
 */
const LIGHT_TEXT = "/brand/logo-light.png";
const DARK_TEXT = "/brand/logo-dark.png";

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

  // Sidebar follows the device theme.
  return (
    <div className="brand brand-logo">
      <picture>
        <source srcSet={LIGHT_TEXT} media="(prefers-color-scheme: dark)" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={DARK_TEXT} alt="FYNE EDGE" onError={() => setFailed(true)} />
      </picture>
    </div>
  );
}
