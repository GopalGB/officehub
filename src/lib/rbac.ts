import type { Role } from "@prisma/client";
import { type Prisma } from "@prisma/client";

export type Viewer = { id: string; role: Role };

/** Always combine this access predicate with caller-supplied filters using AND. */
export function projectAccessWhere(viewer: Viewer): Prisma.ProjectWhereInput {
  return isManagerOrAbove(viewer.role)
    ? {}
    : {
        OR: [
          { ownerId: viewer.id },
          { coOwnerId: viewer.id },
          { members: { some: { id: viewer.id } } },
        ],
      };
}

/** Keep the manager's unrestricted predicate out of an OR, where Prisma drops
 * empty relation filters instead of treating them as a matching branch. */
export function reportAccessWhere(viewer: Viewer): Prisma.TaskWhereInput {
  return isManagerOrAbove(viewer.role)
    ? {}
    : {
        OR: [
          { assigneeId: viewer.id },
          { reporterId: viewer.id },
          { project: projectAccessWhere(viewer) },
        ],
      };
}

export function canEditPage(viewer: Viewer, authorId: string): boolean {
  return viewer.id === authorId || isManagerOrAbove(viewer.role);
}

export function taskPermissions(
  viewer: Viewer,
  task: {
    reporterId: string;
    assigneeId: string | null;
    project: {
      ownerId: string;
      coOwnerId?: string | null;
      members: { id: string }[];
    };
  },
) {
  const editor = canEditProject({
    viewerId: viewer.id,
    viewerRole: viewer.role,
    ownerId: task.project.ownerId,
    coOwnerId: task.project.coOwnerId,
    memberIds: task.project.members.map((member) => member.id),
  });
  return {
    canEdit:
      editor || task.reporterId === viewer.id || task.assigneeId === viewer.id,
    canAssign: editor || task.reporterId === viewer.id,
    canDelete:
      isManagerOrAbove(viewer.role) ||
      task.reporterId === viewer.id ||
      task.assigneeId === viewer.id,
  };
}

export const ROLE_RANK: Record<Role, number> = {
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function atLeast(role: Role | undefined | null, minimum: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isAdmin(role: Role | undefined | null) {
  return atLeast(role, "ADMIN");
}

export function isManagerOrAbove(role: Role | undefined | null) {
  return atLeast(role, "MANAGER");
}

export function canViewAllProjects(role: Role | undefined | null) {
  return isManagerOrAbove(role);
}

export function canManageUsers(role: Role | undefined | null) {
  return isAdmin(role);
}

export function canEditProject(opts: {
  viewerRole: Role | undefined | null;
  viewerId: string | undefined | null;
  ownerId: string;
  coOwnerId?: string | null;
  memberIds?: string[];
}): boolean {
  if (!opts.viewerRole || !opts.viewerId) return false;
  if (isAdmin(opts.viewerRole)) return true;
  if (isManagerOrAbove(opts.viewerRole)) return true;
  if (opts.viewerId === opts.ownerId || opts.viewerId === opts.coOwnerId)
    return true;
  return opts.memberIds?.includes(opts.viewerId) ?? false;
}

export function canViewProject(opts: {
  viewerRole: Role | undefined | null;
  viewerId: string | undefined | null;
  ownerId: string;
  coOwnerId?: string | null;
  memberIds?: string[];
}): boolean {
  if (canViewAllProjects(opts.viewerRole)) return true;
  if (!opts.viewerId) return false;
  if (opts.viewerId === opts.ownerId || opts.viewerId === opts.coOwnerId)
    return true;
  return opts.memberIds?.includes(opts.viewerId) ?? false;
}

export function canDeleteProject(opts: {
  viewerRole: Role | undefined | null;
  viewerId: string | undefined | null;
  ownerId: string;
}): boolean {
  if (!opts.viewerRole || !opts.viewerId) return false;
  if (isAdmin(opts.viewerRole)) return true;
  return opts.viewerId === opts.ownerId;
}
