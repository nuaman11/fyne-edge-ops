"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { initials } from "@/lib/format";

type Item = { href: string; label: string; count?: number };

export function Sidebar({ items, me }: { items: Item[]; me: { name: string; role: "ADMIN" | "USER" } }) {
  const path = usePathname();
  const isOn = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  return (
    <aside className="rail">
      <div className="brand"><span className="mark">FE</span><div><b>FYNE EDGE</b><small>Operations</small></div></div>
      <nav className="nav">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={isOn(i.href) ? "on" : ""}>
            {i.label}{i.count != null ? <span className="count">{i.count}</span> : null}
          </Link>
        ))}
      </nav>
      <div className="uchip">
        <Link href="/account" className="av lg" title="Account settings" style={{ textDecoration: "none" }}>{initials(me.name)}</Link>
        <div className="grow">
          <div className="n">{me.name}</div>
          <span className={`pill ${me.role === "ADMIN" ? "acc" : ""}`}>{me.role === "ADMIN" ? "Admin" : "User"}</span>
        </div>
        <form action={logout}><button className="btn sm ghost">Sign out</button></form>
      </div>
    </aside>
  );
}
