import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { enhancementCreateSchema } from "@/lib/validation";
import { canEditProject, canViewProject } from "@/lib/rbac";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({
    where: { id },
    select: { ownerId: true, members: { select: { id: true } } },
  });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);
  if (
    !canViewProject({
      viewerRole: user!.role,
      viewerId: user!.id,
      ownerId: project.ownerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    return jsonError("FORBIDDEN", "Cannot read enhancements", 403);
  }

  const items = await db.enhancement.findMany({
    where: { projectId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(items);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({
    where: { id },
    select: { ownerId: true, members: { select: { id: true } } },
  });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);
  if (
    !canEditProject({
      viewerRole: user!.role,
      viewerId: user!.id,
      ownerId: project.ownerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    return jsonError("FORBIDDEN", "Cannot add enhancements to this project", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = enhancementCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError("VALIDATION", "Invalid input", 422, parsed.error.flatten());

  const created = await db.enhancement.create({
    data: { ...parsed.data, projectId: id, authorId: user!.id },
  });
  return jsonOk(created, 201);
}
