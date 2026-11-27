import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, projectAccessWhere } from "@/lib/rbac";
import { similarityIndex } from "@/lib/similarity";
import { blockText } from "@/lib/page-text";

export const dynamic = "force-dynamic";

/** Reuse project access so sub-owner search stays consistent without widening member reads. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ data: { projects: [], tasks: [], pages: [], users: [] } });
  }

  const ci = { contains: q, mode: "insensitive" as const };
  const canSeeAll = isManagerOrAbove(session.user.role);

  const projectWhere = { AND: [projectAccessWhere(session.user), { OR: [{ title: ci }, { summary: ci }] }] };
  const taskWhere = canSeeAll
    ? { OR: [{ title: ci }, { description: ci }] }
    : {
        AND: [
          { project: projectAccessWhere(session.user) },
          { OR: [{ title: ci }, { description: ci }] },
        ],
      };

  // Exact matches first, then word-similarity matches ("dashboards for sales"
  // finds "Sales dashboard"), always inside the same access rules.
  const memberTaskScope = canSeeAll ? {} : { project: projectAccessWhere(session.user) };
  const [exactProjects, exactTasks, exactPages, users, poolProjects, poolTasks, poolPages] = await Promise.all([
    db.project.findMany({
      where: projectWhere,
      select: { id: true, title: true, summary: true, status: true },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    db.task.findMany({
      where: taskWhere,
      select: { id: true, title: true, status: true, projectId: true, project: { select: { title: true } } },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    db.page.findMany({
      where: { archived: false, title: ci },
      select: { id: true, title: true, emoji: true },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({
      where: { active: true, OR: [{ name: ci }, { email: ci }] },
      select: { id: true, name: true, email: true, role: true },
      take: 6,
    }),
    db.project.findMany({
      where: projectAccessWhere(session.user),
      select: { id: true, title: true, summary: true, status: true },
      take: 1000,
      orderBy: { updatedAt: "desc" },
    }),
    db.task.findMany({
      where: memberTaskScope,
      select: { id: true, title: true, description: true, status: true, projectId: true, project: { select: { title: true } } },
      take: 1500,
      orderBy: { updatedAt: "desc" },
    }),
    db.page.findMany({
      where: { archived: false },
      select: { id: true, title: true, emoji: true, content: true },
      take: 500,
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const merge = <T extends { id: string }>(exact: T[], similar: T[]) =>
    [...exact, ...similar.filter((s) => !exact.some((e) => e.id === s.id))].slice(0, 6);
  const rank = <T,>(docs: { text: string; item: T }[]) => similarityIndex(docs).rank(q, 6, 0.15).map((m) => m.item);
  const projects = merge(
    exactProjects,
    rank(poolProjects.map((p) => ({ text: `${p.title} ${p.title} ${p.summary ?? ""}`, item: p }))),
  );
  const tasks = merge(
    exactTasks,
    rank(poolTasks.map(({ description, ...t }) => ({ text: `${t.title} ${t.title} ${description ?? ""}`, item: t }))),
  );
  const pages = merge(
    exactPages,
    rank(poolPages.map(({ content, ...p }) => ({ text: `${p.title} ${p.title} ${blockText(content).join(" ")}`, item: p }))),
  );

  return NextResponse.json({ data: { projects, tasks, pages, users } });
}
