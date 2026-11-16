"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { initials } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string; count?: number };
export type NavGroup = { label: string; items: NavItem[] };

export function Sidebar({ groups, me }: { groups: NavGroup[]; me: { name: string; role: "ADMIN" | "USER"; isDeptHead: boolean } }) {
  const path = usePathname();
  const isOn = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  return (
    <aside className="rail">
      <Logo />
      <nav className="nav">
        {groups.map((g) => (
          <div className="ng" key={g.label}>
            <div className="gl">{g.label}</div>
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className={isOn(i.href) ? "on" : ""}>
                <Icon name={i.icon} /><span>{i.label}</span>{i.count ? <span className="count">{i.count}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="uchip">
        <Link href="/account" className="av lg" title="My account" style={{ textDecoration: "none" }}>{initials(me.name)}</Link>
        <div className="grow">
          <div className="n">{me.name}</div>
          <span className={`pill ${me.role === "ADMIN" ? "acc" : ""}`}>{me.role === "ADMIN" ? "Admin" : "User"}{me.isDeptHead ? " · Head" : ""}</span>
        </div>
        <form action={logout}><button className="btn sm ghost">Sign out</button></form>
      </div>
    </aside>
  );
}
