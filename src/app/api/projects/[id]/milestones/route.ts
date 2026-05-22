import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { milestoneCreateSchema } from "@/lib/validation";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const project = await db.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!project) return jsonError("NOT_FOUND", "Project not found", 404);
  if (user!.role === "MEMBER" && project.ownerId !== user!.id) {
    return jsonError("FORBIDDEN", "Cannot read milestones", 403);
  }

  const items = await db.milestone.findMany({
    where: { projectId: id },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { orderIndex: "asc" }],
  });
  return jsonOk(items);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = milestoneCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError("VALIDATION", "Invalid input", 422, parsed.error.flatten());

  const count = await db.milestone.count({ where: { projectId: id } });
  const created = await db.milestone.create({
    data: {
      projectId: id,
      title: parsed.data.title,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      orderIndex: count,
    },
  });
  return jsonOk(created, 201);
}
