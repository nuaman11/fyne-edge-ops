"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, projects, clients } from "@/lib/db";
import { actor, AppError, run, reqStr, optStr, optDate, optId, type ActionResult } from "@/lib/action";

/** Accepts "fyneedge.com" or "https://…"; stores a full https/http URL. Rejects anything else (javascript:, mailto:, …). */
const url = z.string().trim().max(2000).transform((v, ctx) => {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    if (!u.hostname.includes(".") && u.hostname !== "localhost") throw new Error();
    return u.toString();
  } catch {
    ctx.addIssue({ code: "custom", message: `“${v.slice(0, 60)}” isn't a web address. Use something like https://example.com` });
    return z.NEVER;
  }
});

const schema = z.object({
  name: reqStr("Project name", 160),
  category: z.enum(["WEBSITE", "WEB_APP", "MOBILE_APP", "AI_AUTOMATION", "OTHER"]),
  clientId: optId,
  liveUrl: z.union([z.literal(""), z.null(), url]).transform((v) => v || null),
  links: z.array(z.object({ label: z.string().trim().max(60), url })).max(20).default([]),
  description: optStr(3000),
  tech: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  completedOn: optDate,
});

/** Any signed-in team member can add or update a project. */
export async function saveProject(id: string | null, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const v = schema.parse(input);
    const links = v.links.map((l) => ({ label: l.label || "Link", url: l.url }));
    const tech = [...new Set(v.tech.map((t) => t.trim()).filter(Boolean))];
    if (v.clientId) {
      const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, v.clientId)).limit(1);
      if (!c) v.clientId = null;
    }
    const data = { ...v, links, tech };
    if (id) {
      const r = await db.update(projects).set(data).where(eq(projects.id, id)).returning({ id: projects.id });
      if (!r.length) throw new AppError("Project not found. It may have been deleted.");
    } else {
      id = (await db.insert(projects).values({ ...data, createdById: me.id }).returning({ id: projects.id }))[0]!.id;
    }
    revalidatePath("/projects");
    return { ok: true, id };
  });
}

/** Admins, or whoever added the project, can delete it. */
export async function deleteProject(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await actor();
    const [p] = await db.select({ createdById: projects.createdById }).from(projects).where(eq(projects.id, id)).limit(1);
    if (!p) throw new AppError("Project not found. It may have been deleted.");
    if (me.role !== "ADMIN" && p.createdById !== me.id) throw new AppError("Only an admin, or the person who added this project, can delete it.");
    await db.delete(projects).where(eq(projects.id, id));
    revalidatePath("/projects");
  });
}
