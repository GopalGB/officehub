import type { Prisma } from "@prisma/client";
import { isManagerOrAbove, projectAccessWhere, type Viewer } from "@/lib/rbac";
import { projectBoardFilterSchema } from "@/lib/validation";

export const BOARD_STATUSES = [
  "PLANNING",
  "IN_PROGRESS",
  "BLOCKED",
  "ON_HOLD",
  "COMPLETED",
] as const;

/** Combine filters with AND so owner/scope inputs cannot replace project access. */
export function projectBoardFilters(viewer: Viewer, input: unknown) {
  const parsed = projectBoardFilterSchema.parse(input);
  const scope = isManagerOrAbove(viewer.role)
    ? (parsed.scope ?? "all")
    : "mine";
  const owner = parsed.owner || "ALL";
  const where: Prisma.ProjectWhereInput = {
    AND: [
      projectAccessWhere(
        scope === "mine" ? { ...viewer, role: "MEMBER" } : viewer,
      ),
      { status: { in: [...BOARD_STATUSES] } },
      ...(owner !== "ALL" ? [{ ownerId: owner }] : []),
    ],
  };
  return { scope, owner, where };
}
