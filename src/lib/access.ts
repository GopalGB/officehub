import { db } from "@/lib/db";
import {
  canEditPage,
  canEditProject,
  projectAccessWhere,
  type Viewer,
} from "@/lib/rbac";

export async function requireProjectEditor(viewer: Viewer, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId, AND: [projectAccessWhere(viewer)] },
    include: { members: { select: { id: true } } },
  });
  if (!project) throw new Error("Forbidden");
  if (
    !canEditProject({
      viewerRole: viewer.role,
      viewerId: viewer.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds: project.members.map((member) => member.id),
    })
  )
    throw new Error("Forbidden");
  return project;
}

export async function requirePageEditor(viewer: Viewer, pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page || page.archived) throw new Error("Page not found");
  if (!canEditPage(viewer, page.authorId)) throw new Error("Forbidden");
  return page;
}
