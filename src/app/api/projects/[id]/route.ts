import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { projectUpdateSchema } from "@/lib/validation";
import { canDeleteProject, canEditProject, canViewProject } from "@/lib/rbac";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { select: { id: true } },
      milestones: true,
      enhancements: { include: { author: { select: { id: true, name: true } } } },
      updates: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);

  // Managers+ see everything; members see projects they own or belong to
  if (
    !canViewProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: project.ownerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    return jsonError("FORBIDDEN", "Cannot access this project", 403);
  }
  return jsonOk(project);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const existing = await db.project.findUnique({
    where: { id },
    include: { members: { select: { id: true } } },
  });
  if (!existing) return jsonError("NOT_FOUND", "Project not found", 404);
  if (
    !canEditProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: existing.ownerId,
      memberIds: existing.members.map((m) => m.id),
    })
  ) {
    return jsonError("FORBIDDEN", "Cannot edit this project", 403);
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body) return jsonError("INVALID_JSON", "Body must be valid JSON");
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError("VALIDATION", "Invalid input", 422, parsed.error.flatten());

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.summary !== undefined) data.summary = parsed.data.summary ?? null;
  if (parsed.data.description !== undefined) data.description = parsed.data.description ?? null;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.startDate !== undefined) data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  if (parsed.data.targetDate !== undefined) data.targetDate = parsed.data.targetDate ? new Date(parsed.data.targetDate) : null;

  const updated = await db.project.update({ where: { id }, data });
  return jsonOk(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) return jsonError("NOT_FOUND", "Project not found", 404);
  if (!canDeleteProject({ viewerRole: user.role, viewerId: user.id, ownerId: existing.ownerId })) {
    return jsonError("FORBIDDEN", "Cannot delete this project", 403);
  }
  await db.project.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
