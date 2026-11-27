import { requireUser } from "@/lib/auth";
import { listClients, listProjects } from "@/lib/queries";
import { ProjectsView } from "@/components/projects/ProjectsView";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const [projects, clients] = await Promise.all([listProjects(), listClients()]);
  return (
    <ProjectsView projects={projects} clients={clients.map((c) => ({ id: c.id, name: c.name }))} me={{ id: me.id, role: me.role }}
      initial={{ openId: sp.open, newProject: sp.new === "1", category: sp.category, clientId: sp.client }} />
  );
}
