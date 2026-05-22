import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const updates = await db.projectUpdate.findMany({
    where: { projectId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Members can only read updates on projects they own
  const project = await db.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);
  if (user!.role === "MEMBER" && project.ownerId !== user!.id) {
    return jsonError("FORBIDDEN", "Cannot read updates", 403);
  }
  return jsonOk(updates);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body?.content) return jsonError("VALIDATION", "content is required");

  const created = await db.projectUpdate.create({
    data: { projectId: id, authorId: user!.id, content: body.content },
  });
  return jsonOk(created, 201);
}
