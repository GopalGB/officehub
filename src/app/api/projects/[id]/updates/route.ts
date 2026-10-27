import { recordAudit } from "@/lib/history";
import { projectStatusUpdateSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { canEditProject, canViewProject } from "@/lib/rbac";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      ownerId: true,
      coOwnerId: true,
      members: { select: { id: true } },
    },
  });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);
  if (
    !canViewProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    return jsonError("FORBIDDEN", "Cannot read updates", 403);
  }

  const updates = await db.projectUpdate.findMany({
    where: { projectId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jsonOk(updates);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      ownerId: true,
      coOwnerId: true,
      members: { select: { id: true } },
    },
  });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);
  if (
    !canEditProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    return jsonError("FORBIDDEN", "Cannot add updates to this project", 403);
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = projectStatusUpdateSchema.safeParse(body);
  if (!parsed.success)
    return jsonError("VALIDATION", "Valid editor content is required", 422);

  const created = await db.$transaction(async (tx) => {
    const result = await tx.projectUpdate.create({
      data: { projectId: id, authorId: user.id, content: parsed.data.content },
    });
    await recordAudit(
      tx,
      user,
      "ProjectUpdate added through API",
      "ProjectUpdate",
      result.id,
      id,
      null,
      result,
    );
    return result;
  });
  return jsonOk(created, 201);
}
