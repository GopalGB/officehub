import { Role } from "@prisma/client";

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
  memberIds?: string[];
}): boolean {
  if (!opts.viewerRole || !opts.viewerId) return false;
  if (isAdmin(opts.viewerRole)) return true;
  if (isManagerOrAbove(opts.viewerRole)) return true;
  if (opts.viewerId === opts.ownerId) return true;
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
