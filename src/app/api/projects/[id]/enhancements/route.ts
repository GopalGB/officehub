import { recordAudit } from "@/lib/history";
import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { enhancementCreateSchema } from "@/lib/validation";
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
    return jsonError("FORBIDDEN", "Cannot read enhancements", 403);
  }

  const items = await db.enhancement.findMany({
    where: { projectId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(items);
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
    return jsonError(
      "FORBIDDEN",
      "Cannot add enhancements to this project",
      403,
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = enhancementCreateSchema.safeParse(body);
  if (!parsed.success)
    return jsonError(
      "VALIDATION",
      "Invalid input",
      422,
      parsed.error.flatten(),
    );

  const created = await db.$transaction(async (tx) => {
    const result = await tx.enhancement.create({
      data: { ...parsed.data, projectId: id, authorId: user.id },
    });
    await recordAudit(
      tx,
      user,
      "Enhancement added through API",
      "Enhancement",
      result.id,
      id,
      null,
      result,
    );
    return result;
  });
  return jsonOk(created, 201);
}
