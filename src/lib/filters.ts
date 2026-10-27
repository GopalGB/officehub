import type { Prisma } from "@prisma/client";
import { projectAccessWhere, isManagerOrAbove, type Viewer } from "@/lib/rbac";
import { TaskStatusEnum } from "@/lib/validation";

export function taskFilters(viewer: Viewer, input: { scope?: string; status?: string; project?: string }) {
  const scope = input.scope === "reported" || input.scope === "projects" ? input.scope
    : input.scope === "all" && isManagerOrAbove(viewer.role) ? "all" : "mine";
  const status = TaskStatusEnum.safeParse(input.status);
  const where: Prisma.TaskWhereInput = {
    AND: [
      { project: projectAccessWhere(viewer) },
      scope === "mine" ? { assigneeId: viewer.id } : scope === "reported" ? { reporterId: viewer.id } : {},
      status.success ? { status: status.data } : {},
      input.project && input.project !== "ALL" ? { projectId: input.project } : {},
    ],
  };
  return { scope, where };
}

export function calendarPeriod(y?: string, m?: string, now = new Date()) {
  const year = y && /^\d{4}$/.test(y) && Number(y) >= 1900 && Number(y) <= 9998 ? Number(y) : now.getFullYear();
  const month = m && /^\d{1,2}$/.test(m) && Number(m) <= 11 ? Number(m) : now.getMonth();
  return { year, month };
}
