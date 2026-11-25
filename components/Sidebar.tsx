"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/actions/auth";
import { initials } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string; count?: number };
export type NavGroup = { label: string; items: NavItem[] };

/** The four sections people use most get a place in the phone menu bar; everything else is under "More". */
const PHONE_BAR = ["/", "/tickets", "/documents", "/clients"];

export function Sidebar({ groups, me }: { groups: NavGroup[]; me: { name: string; role: "ADMIN" | "USER"; isDeptHead: boolean } }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const isOn = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  const all = groups.flatMap((g) => g.items);
  const bar = PHONE_BAR.map((h) => all.find((i) => i.href === h)).filter((x): x is NavItem => !!x);
  const moreOn = !bar.some((i) => isOn(i.href));

  useEffect(() => { setMore(false); }, [path]);
  useEffect(() => {
    if (!more) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setMore(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [more]);

  const userChip = (
    <div className="uchip">
      <Link href="/account" className="av lg" title="My account" style={{ textDecoration: "none" }}>{initials(me.name)}</Link>
      <div className="grow">
        <div className="n">{me.name}</div>
        <span className={`pill ${me.role === "ADMIN" ? "acc" : ""}`}>{me.role === "ADMIN" ? "Admin" : "User"}{me.isDeptHead ? " · Head" : ""}</span>
      </div>
      <form action={logout}><button className="btn sm ghost">Sign out</button></form>
    </div>
  );

  return (
    <>
      <aside className="rail">
        <Logo />
        <nav className="nav" aria-label="Main">
          {groups.map((g) => (
            <div className="ng" key={g.label}>
              <div className="gl">{g.label}</div>
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className={isOn(i.href) ? "on" : ""} aria-current={isOn(i.href) ? "page" : undefined}>
                  <Icon name={i.icon} /><span>{i.label}</span>{i.count ? <span className="count">{i.count}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {userChip}
      </aside>

      {/* Phone: floating glass menu bar, like the website's */}
      <nav className="mnav" aria-label="Main">
        {bar.map((i) => (
          <Link key={i.href} href={i.href} className={isOn(i.href) ? "on" : ""} aria-current={isOn(i.href) ? "page" : undefined}>
            <span className="mi"><Icon name={i.icon} />{i.count ? <span className="mc">{i.count > 99 ? "99+" : i.count}</span> : null}</span>
            <span className="ml">{i.label}</span>
          </Link>
        ))}
        <button type="button" className={moreOn || more ? "on" : ""} onClick={() => setMore((m) => !m)} aria-expanded={more} aria-controls="more-sheet">
          <span className="mi"><svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg></span>
          <span className="ml">More</span>
        </button>
      </nav>
      {more ? (
        <div className="sheet-scrim" onClick={() => setMore(false)}>
          <div className="sheet" id="more-sheet" role="dialog" aria-modal="true" aria-label="All sections" onClick={(e) => e.stopPropagation()}>
            <span className="sheet-grab" aria-hidden="true" />
            {groups.map((g) => (
              <div className="ng" key={g.label}>
                <div className="gl">{g.label}</div>
                <div className="sheet-grid">
                  {g.items.map((i) => (
                    <Link key={i.href} href={i.href} className={isOn(i.href) ? "on" : ""}>
                      <Icon name={i.icon} /><span>{i.label}</span>{i.count ? <span className="count">{i.count}</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {userChip}
          </div>
        </div>
      ) : null}
    </>
  );
}
