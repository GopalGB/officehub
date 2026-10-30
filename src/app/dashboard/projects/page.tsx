import Link from "next/link";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { projectAccessWhere, isManagerOrAbove } from "@/lib/rbac";
import { ProjectStatusEnum } from "@/lib/validation";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Button } from "@/components/ui/button";
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams,
    parsedStatus = ProjectStatusEnum.safeParse(params.status);
  const pageNumber = Number(params.page),
    page =
      Number.isSafeInteger(pageNumber) && pageNumber > 0
        ? Math.min(pageNumber, 10000)
        : 1;
  const where = {
    AND: [
      projectAccessWhere(session.user),
      parsedStatus.success
        ? { status: parsedStatus.data }
        : { status: { not: "ARCHIVED" as const } },
      ...(params.q
        ? [
            {
              OR: [
                {
                  title: {
                    contains: params.q.slice(0, 200),
                    mode: "insensitive" as const,
                  },
                },
                {
                  summary: {
                    contains: params.q.slice(0, 200),
                    mode: "insensitive" as const,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
  const [projects, count] = await Promise.all([
    db.project.findMany({
      where,
      include: { owner: { select: { id: true, name: true } }, tags: true },
      orderBy: { updatedAt: "desc" },
      take: 24,
      skip: (page - 1) * 24,
    }),
    db.project.count({ where }),
  ]);
  const query = (p: number) =>
    `?${new URLSearchParams({ q: params.q ?? "", status: params.status ?? "", page: String(p) })}`;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            {count} projects · Pick one to see progress and updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManagerOrAbove(session.user.role) && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/projects/import">Import Excel</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard/projects/new">New project</Link>
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="view-switch" aria-label="Project views">
          <Link href="/dashboard/projects" aria-current="page">
            Cards
          </Link>
          <Link href="/dashboard/board">Board</Link>
        </nav>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="field min-w-0 flex-1">
          Find a project
          <input
            name="q"
            maxLength={200}
            placeholder="Search projects…"
            defaultValue={params.q}
          />
        </label>
        <label className="field w-full sm:w-auto">
          Status
          <select
            name="status"
            defaultValue={parsedStatus.success ? parsedStatus.data : ""}
          >
            <option value="">Active projects</option>
            {ProjectStatusEnum.options.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" type="submit">
          Filter
        </Button>
      </form>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
      {!projects.length && (
        <div className="surface py-12 text-center text-sm text-muted-foreground">
          No projects here yet. Create a project or adjust your filters.
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link className="text-link" href={query(page - 1)}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">
          Page {page} of {Math.max(1, Math.ceil(count / 24))}
        </span>
        {page * 24 < count && (
          <Link className="text-link" href={query(page + 1)}>
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
