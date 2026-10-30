import type { Prisma } from "@prisma/client";
import type { Viewer } from "@/lib/rbac";
import { assertAssignablePeople } from "@/lib/project-people";
import {
  canEditProject,
  projectAccessWhere,
  isManagerOrAbove,
} from "@/lib/rbac";

type Actor = Viewer & { name?: string | null };
export function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
export async function recordAudit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  projectId: string | null,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      userId: actor.id,
      action,
      entity,
      entityId,
      projectId,
      meta: jsonSnapshot({ actor: actor.name ?? actor.id, before, after }),
    },
  });
}
/** Bulk child imports keep the same audit shape without a round trip per child. */
export async function recordAudits(
  tx: Prisma.TransactionClient,
  actor: Actor,
  entries: {
    action: string;
    entity: string;
    entityId: string;
    projectId: string | null;
    before: unknown;
    after: unknown;
  }[],
) {
  if (!entries.length) return;
  await tx.auditLog.createMany({
    data: entries.map((entry) => ({
      userId: actor.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      projectId: entry.projectId,
      meta: jsonSnapshot({
        actor: actor.name ?? actor.id,
        before: entry.before,
        after: entry.after,
      }),
    })),
  });
}
const snapshotInclude = {
  members: { select: { id: true } },
  tags: { select: { id: true } },
} as const;
export async function saveProjectRevision(
  tx: Prisma.TransactionClient,
  projectId: string,
  actor: Actor,
  reason: string,
) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    include: snapshotInclude,
  });
  await tx.projectRevision.upsert({
    where: { projectId_version: { projectId, version: project.version } },
    update: {},
    create: {
      projectId,
      version: project.version,
      authorId: actor.id,
      authorName: actor.name ?? actor.id,
      reason,
      snapshot: jsonSnapshot(project),
    },
  });
  return project;
}
export async function reviseProject(
  tx: Prisma.TransactionClient,
  actor: Actor,
  projectId: string,
  data: Prisma.ProjectUpdateInput,
  reason: string,
  expectedVersion?: number,
) {
  const before = await tx.project.findUnique({
    where: { id: projectId, AND: [projectAccessWhere(actor)] },
    include: snapshotInclude,
  });
  if (
    !before ||
    !canEditProject({
      viewerRole: actor.role,
      viewerId: actor.id,
      ownerId: before.ownerId,
      coOwnerId: before.coOwnerId,
      memberIds: before.members.map((m) => m.id),
    })
  )
    throw new Error("Forbidden");
  const ownerId =
    typeof data.owner?.connect?.id === "string"
      ? data.owner.connect.id
      : before.ownerId;
  const coOwnerId = data.coOwner?.disconnect
    ? null
    : typeof data.coOwner?.connect?.id === "string"
      ? data.coOwner.connect.id
      : before.coOwnerId;
  if (
    (ownerId !== before.ownerId ||
      coOwnerId !== before.coOwnerId ||
      data.members !== undefined) &&
    actor.id !== before.ownerId &&
    !isManagerOrAbove(actor.role)
  )
    throw new Error(
      "Only the owner or a manager can change project ownership or collaborators",
    );
  if (expectedVersion !== undefined && before.version !== expectedVersion)
    throw new Error("This project changed elsewhere. Reload before saving.");
  const rosterChanges = [data.members?.set, data.members?.connect].flatMap(
    (value) => (value ? (Array.isArray(value) ? value : [value]) : []),
  );
  await assertAssignablePeople(
    [
      ...(ownerId !== before.ownerId ? [ownerId] : []),
      ...(coOwnerId && coOwnerId !== before.coOwnerId ? [coOwnerId] : []),
      ...rosterChanges.flatMap((person) =>
        typeof person.id === "string" &&
        !before.members.some((existing) => existing.id === person.id)
          ? [person.id]
          : [],
      ),
    ],
    tx,
  );
  await saveProjectRevision(tx, projectId, actor, "Previous saved state");
  const status = typeof data.status === "string" ? data.status : before.status;
  const after = await tx.project.update({
    where: { id: projectId, version: before.version },
    data: {
      ...data,
      version: { increment: 1 },
      actualEndDate:
        data.actualEndDate !== undefined
          ? data.actualEndDate
          : status === "COMPLETED"
            ? (before.actualEndDate ?? new Date())
            : status === "ARCHIVED"
              ? before.actualEndDate
              : null,
    },
  });
  const snapshot = await saveProjectRevision(tx, projectId, actor, reason);
  await recordAudit(
    tx,
    actor,
    reason,
    "Project",
    projectId,
    projectId,
    before,
    snapshot,
  );
  return after;
}
