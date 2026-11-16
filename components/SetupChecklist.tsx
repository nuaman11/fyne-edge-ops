"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, Icon } from "@/components/ui";

export type SetupStep = { title: string; text: string; done: boolean; href: string; action: string };
const KEY = "fyne-setup-hidden";

/** First-time setup list for admins. Disappears once every step is done, or when hidden. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(KEY) === "1"); } catch { setHidden(false); } }, []);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  return (
    <section className="panel setup">
      <div className="ph">
        <h2>Set up your workspace <span className="n">{done} of {steps.length} done</span></h2>
        <button className="btn sm ghost" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setHidden(true); }}>Hide</button>
      </div>
      <Bar value={done} max={steps.length} />
      <div>
        {steps.map((s) => (
          <div className={`step ${s.done ? "done" : ""}`} key={s.title}>
            <span className="ck">{s.done ? <Icon name="check" /> : null}</span>
            <div className="grow"><b>{s.title}</b><span>{s.text}</span></div>
            {s.done ? null : <Link className="btn sm" href={s.href}>{s.action}</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}
