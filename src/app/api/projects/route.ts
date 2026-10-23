import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { projectCreateSchema } from "@/lib/validation";
import { isManagerOrAbove } from "@/lib/rbac";

export async function GET(req: Request) {
  const { user, response } = await requireApiAuth();
  if (response) return response;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "mine";
  const status = url.searchParams.get("status") ?? undefined;
  const ownerId = url.searchParams.get("owner") ?? undefined;
  // ?limit=abc previously passed NaN into Prisma `take` and crashed with a 500 (OH-01).
  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (scope === "mine") {
    // scope=mine must lock the filter to the caller: a ?owner=<id> query param
    // must not be able to overwrite it and leak other users' projects (OH-03).
    where.ownerId = user!.id;
  } else {
    // Any non-"mine" scope (including unknown values) lists other people's
    // projects, so gate it to manager+ (OH-03).
    if (!isManagerOrAbove(user!.role)) {
      return jsonError("FORBIDDEN", "Members can only list their own projects", 403);
    }
    if (ownerId) where.ownerId = ownerId;
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
      // Only manager+ may create a project owned by someone else; a MEMBER
      // passing ownerId previously forged ownership (OH-02).
      ownerId:
        parsed.data.ownerId && isManagerOrAbove(user!.role) ? parsed.data.ownerId : user!.id,
    },
  });
  return jsonOk(project, 201);
}
