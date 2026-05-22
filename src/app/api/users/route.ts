import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { jsonError, jsonOk, requireApiAuth } from "@/lib/api";
import { isAdmin, isManagerOrAbove } from "@/lib/rbac";
import { userCreateSchema } from "@/lib/validation";

export async function GET() {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  if (!isManagerOrAbove(user!.role)) return jsonError("FORBIDDEN", "Manager+ only", 403);

  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return jsonOk(users);
}

export async function POST(req: Request) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  if (!isAdmin(user!.role)) return jsonError("FORBIDDEN", "Admin only", 403);

  const body = await req.json().catch(() => null);
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError("VALIDATION", "Invalid input", 422, parsed.error.flatten());

  const existing = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) return jsonError("DUPLICATE", "Email already registered", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const created = await db.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
  return jsonOk(created, 201);
}
