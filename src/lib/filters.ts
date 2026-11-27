import type { Prisma } from "@prisma/client";
import { projectAccessWhere, isManagerOrAbove, type Viewer } from "@/lib/rbac";
import { TaskStatusEnum } from "@/lib/validation";

export function taskFilters(viewer: Viewer, input: { scope?: string; status?: string; project?: string; brand?: string; kind?: string }) {
  const scope = input.scope === "reported" || input.scope === "projects" ? input.scope
    : input.scope === "all" && isManagerOrAbove(viewer.role) ? "all" : "mine";
  const status = TaskStatusEnum.safeParse(input.status);
  const where: Prisma.TaskWhereInput = {
    AND: [
      { project: projectAccessWhere(viewer) },
      scope === "mine" ? { assigneeId: viewer.id } : scope === "reported" ? { reporterId: viewer.id } : {},
      status.success ? { status: status.data } : {},
      input.project && input.project !== "ALL" ? { projectId: input.project } : {},
      // Optional filters are only added when chosen.
      ...(input.brand && input.brand !== "ALL" ? [input.brand === "NONE" ? { brandId: null } : { brandId: input.brand }] : []),
      ...(input.kind && ["REPORT", "DASHBOARD", "ADHOC", "OTHER"].includes(input.kind) ? [{ kind: input.kind }] : []),
    ],
  };
  return { scope, where };
}

export function calendarPeriod(y?: string, m?: string, now = new Date()) {
  const year = y && /^\d{4}$/.test(y) && Number(y) >= 1900 && Number(y) <= 9998 ? Number(y) : now.getFullYear();
  const month = m && /^\d{1,2}$/.test(m) && Number(m) <= 11 ? Number(m) : now.getMonth();
  return { year, month };
}
