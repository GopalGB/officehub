import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { projectCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const { user, response } = await requireApiAuth();
  if (response) return response;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "mine";
  const status = url.searchParams.get("status") ?? undefined;
  const ownerId = url.searchParams.get("owner") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const where: Record<string, unknown> = {};
  if (scope === "mine") where.ownerId = user!.id;
  if (status) where.status = status;
  if (ownerId) where.ownerId = ownerId;

  // members can only see their own unless scope=all + role>=MANAGER
  if (scope === "all" && user!.role === "MEMBER") {
    return jsonError("FORBIDDEN", "Members can only list their own projects", 403);
  }

  const projects = await db.project.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return jsonOk(projects);
}

export async function POST(req: Request) {
  const { user, response } = await requireApiAuth();
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("INVALID_JSON", "Body must be valid JSON");
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError("VALIDATION", "Invalid input", 422, parsed.error.flatten());

  const project = await db.project.create({
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      description: parsed.data.description ?? undefined,
      status: parsed.data.status,
      priority: parsed.data.priority,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
      ownerId: parsed.data.ownerId ?? user!.id,
    },
  });
  return jsonOk(project, 201);
}
