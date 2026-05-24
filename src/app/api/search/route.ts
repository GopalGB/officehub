import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";

export const dynamic = "force-dynamic";

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
  const userId = session.user.id;

  const projectWhere = canSeeAll
    ? { OR: [{ title: ci }, { summary: ci }] }
    : {
        AND: [
          { OR: [{ ownerId: userId }, { members: { some: { id: userId } } }] },
          { OR: [{ title: ci }, { summary: ci }] },
        ],
      };
  const taskWhere = canSeeAll
    ? { OR: [{ title: ci }, { description: ci }] }
    : {
        AND: [
          { OR: [{ assigneeId: userId }, { reporterId: userId }] },
          { OR: [{ title: ci }, { description: ci }] },
        ],
      };

  const [projects, tasks, pages, users] = await Promise.all([
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
  ]);

  return NextResponse.json({ data: { projects, tasks, pages, users } });
}
