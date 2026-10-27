"use server";

import { randomBytes } from "node:crypto";
import { recordAudit, reviseProject, saveProjectRevision } from "@/lib/history";
import { weekStart, addDays, dateKey } from "@/lib/fiscal";
import { z } from "zod";
import { formText } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import {
  commentCreateSchema,
  workspaceEnhancementCreateSchema,
  workspaceEnhancementUpdateSchema,
  inviteAcceptSchema,
  inviteCreateSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  moveProjectSchema,
  moveTaskSchema,
  TaskStatusEnum,
  pageCreateSchema,
  pageSaveSchema,
  workspaceProjectCreateSchema,
  projectStatusUpdateSchema,
  workspaceProjectUpdateSchema,
  tagCreateSchema,
  reportCreateSchema,
  reportUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
  workPlanSchema,
  dailyOverrideSchema,
  requestLinkSchema,
  publicRequestSchema,
  requestDecisionSchema,
  fiscalConfigSchema,
  idSchema,
  restoreRevisionSchema,
} from "@/lib/validation";
import {
  generateInviteToken,
  inviteExpiry,
  inviteUrl,
} from "@/lib/invitations";
import {
  canDeleteProject,
  canEditProject,
  isAdmin,
  isManagerOrAbove,
  projectAccessWhere,
} from "@/lib/rbac";
import { requireProjectEditor, requirePageEditor } from "@/lib/access";
import type { Prisma, ProjectStatus, TaskStatus, Role } from "@prisma/client";

// ---------------- Board ordering helpers ----------------

const ORDER_STEP = 1024;
const ORDER_PRECISION_FLOOR = 0.001;

type Placement = "above" | "below";
type Sibling = { id: string; orderIndex: number };

function neighbourOrderIndex(
  siblings: Sibling[],
  targetId: string,
  placement: Placement,
): { before: Sibling | null; after: Sibling | null } {
  const idx = siblings.findIndex((s) => s.id === targetId);
  if (idx < 0) return { before: null, after: null };
  if (placement === "above") {
    return { before: idx > 0 ? siblings[idx - 1] : null, after: siblings[idx] };
  }
  return {
    before: siblings[idx],
    after: idx < siblings.length - 1 ? siblings[idx + 1] : null,
  };
}

// Two users dropping into the same gap concurrently can compute the same
// midpoint, leaving two rows with an equal orderIndex. We accept this: the board
// queries break ties deterministically (priority, then updatedAt) so the order
// stays stable, and the next drag of either card recomputes a fresh midpoint and
// self-heals. A UNIQUE(status, orderIndex) constraint was rejected — it would
// force retry logic on every insert/seed to defend against a rare, cosmetic, and
// self-correcting collision.
function midpoint(
  before: Sibling | null,
  after: Sibling | null,
  siblings: Sibling[],
): number {
  if (!before && !after) {
    return siblings.length
      ? siblings[siblings.length - 1].orderIndex + ORDER_STEP
      : 0;
  }
  if (!before && after) return after.orderIndex - ORDER_STEP;
  if (before && !after) return before.orderIndex + ORDER_STEP;
  return (before!.orderIndex + after!.orderIndex) / 2;
}

function needsRebalance(
  before: Sibling | null,
  after: Sibling | null,
): boolean {
  if (!before || !after) return false;
  return Math.abs(before.orderIndex - after.orderIndex) < ORDER_PRECISION_FLOOR;
}

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseJSON<T = unknown>(v: FormDataEntryValue | null): T | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

// ---------------- Projects ----------------

function workspaceFields(fd: FormData) {
  return Object.fromEntries(
    [
      "ownerId",
      "coOwnerId",
      "projectType",
      "sourceProjectId",
      "estimatedHours",
      "savedHours",
      "department",
      "acceptanceCriteria",
      "expectedVersion",
    ]
      .filter((key) => fd.has(key))
      .map((key) => [key, formText(fd, key)]),
  );
}
function checkedRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
) {
  if (start && end && new Date(start) > new Date(end))
    throw new Error("The deadline must be on or after the start date");
}
async function checkProjectPeople(
  user: { id: string; role: Role },
  ownerId: string,
  coOwnerId: string | null,
  sourceProjectId: string | null,
  projectId?: string,
) {
  const ids = [
    ...new Set([ownerId, coOwnerId].filter((id): id is string => !!id)),
  ];
  if (
    (await db.user.count({ where: { id: { in: ids }, active: true } })) !==
    ids.length
  )
    throw new Error("Choose active project owners");
  if (sourceProjectId) {
    if (sourceProjectId === projectId)
      throw new Error("A project cannot enhance itself");
    let next: string | null = sourceProjectId;
    const visited = new Set<string>();
    while (next) {
      if (next === projectId || visited.has(next))
        throw new Error("The source would create a project cycle");
      visited.add(next);
      const source: { sourceProjectId: string | null } | null =
        await db.project.findUnique({
          where: { id: next, AND: [projectAccessWhere(user)] },
          select: { sourceProjectId: true },
        });
      if (!source) throw new Error("Source project is unavailable");
      next = source.sourceProjectId;
    }
  }
}
function refreshWorkspace(projectId?: string) {
  revalidatePath("/dashboard", "layout");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
}
export async function createProject(formData: FormData) {
  const user = await requireSession();
  const parsed = workspaceProjectCreateSchema.parse({
    ...Object.fromEntries(formData),
    ...workspaceFields(formData),
    description: parseJSON(formData.get("description")),
  });
  const ownerId = isManagerOrAbove(user.role)
    ? (parsed.ownerId ?? user.id)
    : user.id;
  const coOwnerId = parsed.coOwnerId ?? null;
  await checkProjectPeople(
    user,
    ownerId,
    coOwnerId,
    parsed.sourceProjectId ?? null,
  );
  checkedRange(parsed.startDate, parsed.targetDate);
  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        title: parsed.title,
        summary: parsed.summary,
        description: parsed.description ?? undefined,
        status: parsed.status,
        priority: parsed.priority,
        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
        targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
        actualEndDate: parsed.status === "COMPLETED" ? new Date() : null,
        ownerId,
        coOwnerId,
        sourceProjectId: parsed.sourceProjectId,
        projectType: parsed.projectType ?? "NEW_PROJECT",
        estimatedHours: parsed.estimatedHours,
        savedHours: parsed.savedHours,
        department: parsed.department,
        acceptanceCriteria: parsed.acceptanceCriteria,
        // A member who creates a project with a different co-owner keeps access.
        members: { connect: { id: user.id } },
      },
    });
    await saveProjectRevision(tx, created.id, user, "Project created");
    await recordAudit(
      tx,
      user,
      "Project created",
      "Project",
      created.id,
      created.id,
      null,
      created,
    );
    return created;
  });
  refreshWorkspace(project.id);
  redirect(`/dashboard/projects/${project.id}`);
}
export async function updateProject(projectId: string, formData: FormData) {
  const user = await requireSession();
  const existing = await requireProjectEditor(user, projectId);
  const parsed = workspaceProjectUpdateSchema.parse({
    ...Object.fromEntries(formData),
    ...workspaceFields(formData),
    ...(formData.has("description") && {
      description: parseJSON(formData.get("description")),
    }),
  });
  if (
    ((parsed.ownerId !== undefined && parsed.ownerId !== existing.ownerId) ||
      (parsed.coOwnerId !== undefined &&
        parsed.coOwnerId !== existing.coOwnerId)) &&
    !isManagerOrAbove(user.role) &&
    existing.ownerId !== user.id
  )
    throw new Error("Only the owner or a manager can change ownership");
  const ownerId = parsed.ownerId ?? existing.ownerId;
  const coOwnerId =
    parsed.coOwnerId === undefined ? existing.coOwnerId : parsed.coOwnerId;
  const sourceId =
    parsed.sourceProjectId === undefined
      ? existing.sourceProjectId
      : parsed.sourceProjectId;
  await checkProjectPeople(user, ownerId, coOwnerId, sourceId, projectId);
  checkedRange(
    parsed.startDate === undefined ? existing.startDate : parsed.startDate,
    parsed.targetDate === undefined ? existing.targetDate : parsed.targetDate,
  );
  const {
    expectedVersion,
    ownerId: _owner,
    coOwnerId: _coOwner,
    sourceProjectId: _source,
    description,
    startDate,
    targetDate,
    ...fields
  } = parsed;
  void _owner;
  void _coOwner;
  void _source;
  await db.$transaction((tx) =>
    reviseProject(
      tx,
      user,
      projectId,
      {
        ...fields,
        ...(description !== undefined && { description: description ?? [] }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(targetDate !== undefined && {
          targetDate: targetDate ? new Date(targetDate) : null,
        }),
        owner: { connect: { id: ownerId } },
        coOwner: coOwnerId
          ? { connect: { id: coOwnerId } }
          : { disconnect: true },
        sourceProject: sourceId
          ? { connect: { id: sourceId } }
          : { disconnect: true },
      },
      "Project details updated",
      expectedVersion ?? existing.version,
    ),
  );
  refreshWorkspace(projectId);
}

export async function deleteProject(projectId: string) {
  const user = await requireSession();
  const existing = await db.project.findUnique({ where: { id: projectId } });
  if (!existing) throw new Error("Project not found");
  if (
    !canDeleteProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: existing.ownerId,
    })
  ) {
    throw new Error("Forbidden");
  }
  await db.$transaction(async (tx) => {
    await recordAudit(
      tx,
      user,
      "Project deleted",
      "Project",
      projectId,
      projectId,
      existing,
      null,
    );
    await tx.project.delete({ where: { id: projectId } });
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  redirect("/dashboard");
}

async function trackChild<T extends { id: string }>(
  actor: { id: string; role: Role; name?: string | null },
  projectId: string,
  entity: string,
  action: string,
  before: unknown,
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    const after = await mutate(tx);
    await recordAudit(
      tx,
      actor,
      action,
      entity,
      after.id,
      projectId,
      before,
      action.endsWith("deleted") ? null : after,
    );
    return after;
  });
}

// ---------------- Project Updates ----------------

export async function addProjectUpdate(projectId: string, formData: FormData) {
  const user = await requireSession();
  await requireProjectEditor(user, projectId);
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const parsed = projectStatusUpdateSchema.safeParse({
    content: parseJSON(formData.get("content")),
  });
  if (!parsed.success || !parsed.data.content)
    throw new Error("Update body is required");

  await trackChild(
    user,
    projectId,
    "ProjectUpdate",
    "Progress update added",
    null,
    (tx) =>
      tx.projectUpdate.create({
        data: {
          projectId,
          authorId: user.id,
          content: parsed.data.content,
        },
      }),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Enhancements ----------------

export async function addEnhancement(projectId: string, formData: FormData) {
  const user = await requireSession();
  await requireProjectEditor(user, projectId);
  const parsed = workspaceEnhancementCreateSchema.safeParse({
    ...Object.fromEntries(formData),
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status") || "PROPOSED",
    priority: formData.get("priority") || "MEDIUM",
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  checkedRange(parsed.data.startDate, parsed.data.targetDate);
  const { expectedVersion, ...fields } = parsed.data;
  void expectedVersion;
  await db.$transaction(async (tx) => {
    const after = await tx.enhancement.create({
      data: {
        ...fields,
        startDate: fields.startDate ? new Date(fields.startDate) : null,
        targetDate: fields.targetDate ? new Date(fields.targetDate) : null,
        completedAt: fields.status === "DONE" ? new Date() : null,
        projectId,
        authorId: user.id,
      },
    });
    await recordAudit(
      tx,
      user,
      "Enhancement added",
      "Enhancement",
      after.id,
      projectId,
      null,
      after,
    );
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function updateEnhancement(
  id: string,
  projectId: string,
  formData: FormData,
) {
  const user = await requireSession();
  const existing = await db.enhancement.findUnique({ where: { id } });
  if (!existing || existing.projectId !== projectId)
    throw new Error("Not found");
  await requireProjectEditor(user, existing.projectId);
  const parsed = workspaceEnhancementUpdateSchema.safeParse({
    ...Object.fromEntries(formData),
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const { expectedVersion, startDate, targetDate, ...fields } = parsed.data;
  checkedRange(
    startDate === undefined ? existing.startDate : startDate,
    targetDate === undefined ? existing.targetDate : targetDate,
  );
  if (expectedVersion !== undefined && expectedVersion !== existing.version)
    throw new Error(
      "This enhancement changed elsewhere. Reload before saving.",
    );
  await db.$transaction(async (tx) => {
    const after = await tx.enhancement.update({
      where: { id, version: existing.version },
      data: {
        ...fields,
        version: { increment: 1 },
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(targetDate !== undefined && {
          targetDate: targetDate ? new Date(targetDate) : null,
        }),
        ...(fields.status && {
          completedAt:
            fields.status === "DONE"
              ? (existing.completedAt ?? new Date())
              : null,
        }),
      },
    });
    await recordAudit(
      tx,
      user,
      "Enhancement updated",
      "Enhancement",
      id,
      projectId,
      existing,
      after,
    );
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteEnhancement(id: string, projectId: string) {
  const user = await requireSession();
  const existing = await db.enhancement.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.projectId !== projectId) throw new Error("Not found");
  await requireProjectEditor(user, existing.projectId);
  await db.$transaction(async (tx) => {
    await tx.enhancement.delete({ where: { id } });
    await recordAudit(
      tx,
      user,
      "Enhancement deleted",
      "Enhancement",
      id,
      projectId,
      existing,
      null,
    );
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Milestones ----------------

export async function addMilestone(projectId: string, formData: FormData) {
  const user = await requireSession();
  await requireProjectEditor(user, projectId);
  const parsed = milestoneCreateSchema.safeParse({
    title: formData.get("title"),
    dueDate: formData.get("dueDate") || null,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const count = await db.milestone.count({ where: { projectId } });
  await trackChild(
    user,
    projectId,
    "Milestone",
    "Milestone added",
    null,
    (tx) =>
      tx.milestone.create({
        data: {
          projectId,
          title: parsed.data.title,
          dueDate: parseDate(formData.get("dueDate")),
          orderIndex: count,
        },
      }),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function toggleMilestone(
  id: string,
  projectId: string,
  completed: boolean,
) {
  const user = await requireSession();
  const existing = await db.milestone.findUnique({ where: { id } });
  if (!existing || existing.projectId !== projectId)
    throw new Error("Not found");
  await requireProjectEditor(user, existing.projectId);
  z.boolean().parse(completed);
  await trackChild(
    user,
    projectId,
    "Milestone",
    "Milestone completion changed",
    existing,
    (tx) =>
      tx.milestone.update({
        where: { id },
        data: { completed, completedAt: completed ? new Date() : null },
      }),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteMilestone(id: string, projectId: string) {
  const user = await requireSession();
  const existing = await db.milestone.findUnique({ where: { id } });
  if (!existing || existing.projectId !== projectId)
    throw new Error("Not found");
  await requireProjectEditor(user, existing.projectId);
  await trackChild(
    user,
    projectId,
    "Milestone",
    "Milestone deleted",
    existing,
    (tx) => tx.milestone.delete({ where: { id } }),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Comments ----------------

export async function addComment(projectId: string, formData: FormData) {
  const user = await requireSession();
  await requireProjectEditor(user, projectId);
  const parsed = commentCreateSchema.safeParse({
    content: formData.get("content"),
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await trackChild(user, projectId, "Comment", "Comment added", null, (tx) =>
    tx.comment.create({
      data: { projectId, authorId: user.id, content: parsed.data.content },
    }),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteComment(id: string, projectId: string) {
  const user = await requireSession();
  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.projectId !== projectId) throw new Error("Not found");
  await requireProjectEditor(user, existing.projectId);
  await trackChild(
    user,
    projectId,
    "Comment",
    "Comment deleted",
    existing,
    (tx) => tx.comment.delete({ where: { id } }),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Users (admin) ----------------

export async function createUser(formData: FormData) {
  const me = await requireSession();
  if (!isAdmin(me.role)) throw new Error("Forbidden");
  const parsed = userCreateSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role") || "MEMBER",
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
  });
  revalidatePath("/dashboard/team");
}

export async function updateUser(userId: string, formData: FormData) {
  const me = await requireSession();
  if (!isAdmin(me.role)) throw new Error("Forbidden");
  const parsed = userUpdateSchema.safeParse({
    name: formData.get("name") ?? undefined,
    role: formData.get("role") ?? undefined,
    active:
      formData.get("active") === "true"
        ? true
        : formData.get("active") === "false"
          ? false
          : undefined,
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password)
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  if (
    userId === me.id &&
    ((parsed.data.role && parsed.data.role !== "ADMIN") ||
      parsed.data.active === false)
  ) {
    throw new Error("You cannot demote or deactivate your own account");
  }
  await db.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw new Error("User not found");
      if (
        target.active &&
        target.role === "ADMIN" &&
        (parsed.data.active === false ||
          (parsed.data.role && parsed.data.role !== "ADMIN"))
      ) {
        const admins = await tx.user.count({
          where: { active: true, role: "ADMIN" },
        });
        if (admins <= 1)
          throw new Error("Keep at least one active administrator");
      }
      await tx.user.update({ where: { id: userId }, data });
    },
    { isolationLevel: "Serializable" },
  );
  revalidatePath("/dashboard/team");
}

// ---------------- Invitations ----------------

export async function createInvitation(
  formData: FormData,
): Promise<{ url: string; email: string } | { error: string }> {
  const me = await requireSession();
  if (!isAdmin(me.role)) return { error: "Admin only" };
  const parsed = inviteCreateSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || "MEMBER",
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const email = parsed.data.email.toLowerCase();
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) return { error: "A user with this email already exists" };

  const pending = await db.invitation.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) {
    return { url: inviteUrl(pending.token), email };
  }

  const token = generateInviteToken();
  await db.invitation.create({
    data: {
      email,
      role: parsed.data.role,
      token,
      invitedById: me.id,
      expiresAt: inviteExpiry(),
    },
  });
  revalidatePath("/dashboard/team");
  return { url: inviteUrl(token), email };
}

export async function revokeInvitation(id: string) {
  const me = await requireSession();
  if (!isAdmin(me.role)) throw new Error("Forbidden");
  await db.invitation.delete({ where: { id } });
  revalidatePath("/dashboard/team");
}

export async function acceptInvitation(token: string, formData: FormData) {
  const parsed = inviteAcceptSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const invite = await db.invitation.findUnique({ where: { token } });
  if (!invite) return { error: "Invitation not found" };
  if (invite.acceptedAt)
    return { error: "This invitation has already been used" };
  if (invite.expiresAt < new Date())
    return { error: "This invitation has expired" };

  const existing = await db.user.findUnique({ where: { email: invite.email } });
  if (existing)
    return {
      error: "An account with this email already exists. Sign in instead.",
    };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await db.user.create({
    data: {
      email: invite.email,
      name: parsed.data.name,
      passwordHash,
      role: invite.role,
    },
  });

  await db.invitation.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date(), acceptedUserId: user.id },
  });

  await signIn("credentials", {
    email: invite.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
  return { ok: true };
}

// ---------------- Tags ----------------

export async function createTag(formData: FormData) {
  const me = await requireSession();
  if (!isManagerOrAbove(me.role)) throw new Error("Forbidden");
  const parsed = tagCreateSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await db.tag.upsert({
    where: { name: parsed.data.name },
    update: { color: parsed.data.color ?? undefined },
    create: { name: parsed.data.name, color: parsed.data.color ?? "#94a3b8" },
  });
  revalidatePath("/dashboard/projects");
}

export async function setProjectTags(projectId: string, tagIds: string[]) {
  const user = await requireSession();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { id: true } } },
  });
  if (!project) throw new Error("Project not found");
  if (
    !canEditProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    throw new Error("Forbidden");
  }
  z.array(idSchema).max(100).parse(tagIds);
  await db.$transaction((tx) =>
    reviseProject(
      tx,
      user,
      projectId,
      { tags: { set: tagIds.map((id) => ({ id })) } },
      "Project tags changed",
    ),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/board");
  revalidatePath("/dashboard/manager");
}

// ---------------- Inline quick edits ----------------

export async function quickUpdateProjectStatus(
  projectId: string,
  status: ProjectStatus,
) {
  const user = await requireSession();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { id: true } } },
  });
  if (!project) throw new Error("Project not found");
  if (
    !canEditProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    throw new Error("Forbidden");
  }
  const parsedStatus = z
    .enum([
      "PLANNING",
      "IN_PROGRESS",
      "BLOCKED",
      "ON_HOLD",
      "COMPLETED",
      "ARCHIVED",
    ])
    .parse(status);
  await db.$transaction((tx) =>
    reviseProject(
      tx,
      user,
      projectId,
      { status: parsedStatus },
      "Project status changed",
    ),
  );
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/board");
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export type MoveProjectArgs = {
  projectId: string;
  toStatus: ProjectStatus;
  targetCardId?: string | null;
  placement?: Placement;
};

export async function moveProject(args: MoveProjectArgs) {
  const user = await requireSession();
  const parsed = moveProjectSchema.safeParse(args);
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid move");
  const { projectId, toStatus } = parsed.data;
  let targetCardId = parsed.data.targetCardId ?? null;
  const placement: Placement = parsed.data.placement ?? "below";

  await db.$transaction(
    async (tx) => {
      // RBAC re-checked with fresh data INSIDE the transaction so a membership
      // change racing with an in-flight drag can't slip past the gate.
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: { members: { select: { id: true } } },
      });
      if (!project) throw new Error("Project not found");
      if (
        !canEditProject({
          viewerRole: user.role,
          viewerId: user.id,
          ownerId: project.ownerId,
          coOwnerId: project.coOwnerId,
          memberIds: project.members.map((m) => m.id),
        })
      ) {
        throw new Error("Forbidden");
      }

      const siblings = await tx.project.findMany({
        where: { status: toStatus, id: { not: projectId } },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true },
      });
      // A client-supplied targetCardId that isn't actually in the destination
      // column (stale or forged) is ignored — fall back to appending.
      if (targetCardId && !siblings.some((s) => s.id === targetCardId)) {
        targetCardId = null;
      }
      let before: Sibling | null = null;
      let after: Sibling | null = null;
      if (targetCardId) {
        ({ before, after } = neighbourOrderIndex(
          siblings,
          targetCardId,
          placement,
        ));
      }
      let newOrderIndex = midpoint(before, after, siblings);
      if (needsRebalance(before, after)) {
        // Parallelize the re-spread so N updates cost ~1 round-trip, not N —
        // critical over the high-latency remote DB where serial awaits time out.
        await Promise.all(
          siblings.map((s, i) =>
            tx.project.update({
              where: { id: s.id },
              data: { orderIndex: i * ORDER_STEP },
            }),
          ),
        );
        const beforeIdx = before
          ? siblings.findIndex((s) => s.id === before.id)
          : -1;
        const afterIdx = after
          ? siblings.findIndex((s) => s.id === after.id)
          : -1;
        if (beforeIdx >= 0 && afterIdx >= 0) {
          newOrderIndex = (beforeIdx * ORDER_STEP + afterIdx * ORDER_STEP) / 2;
        } else if (beforeIdx >= 0) {
          newOrderIndex = beforeIdx * ORDER_STEP + ORDER_STEP / 2;
        } else if (afterIdx >= 0) {
          newOrderIndex = afterIdx * ORDER_STEP - ORDER_STEP / 2;
        } else {
          newOrderIndex = 0;
        }
      }

      const data: Prisma.ProjectUpdateInput = {
        status: toStatus,
        orderIndex: newOrderIndex,
      };
      if (toStatus === "COMPLETED" && project.status !== "COMPLETED") {
        data.actualEndDate = new Date();
      } else if (toStatus !== "COMPLETED" && project.status === "COMPLETED") {
        data.actualEndDate = null;
      }
      await reviseProject(tx, user, projectId, data, "Project moved on board");
    },
    { timeout: 15000 },
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/board");
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Tasks ----------------

export async function createTask(projectId: string, formData: FormData) {
  const user = await requireSession();
  await requireProjectEditor(user, projectId);
  const parsed = reportCreateSchema.safeParse({
    reportUrl: formData.get("reportUrl") || null,
    estimatedHours: formData.get("estimatedHours") || null,
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status") || "TODO",
    priority: formData.get("priority") || "MEDIUM",
    storyPoints: formData.get("storyPoints") || undefined,
    dueDate: formData.get("dueDate") || null,
    assigneeId: formData.get("assigneeId") || null,
    parentId: formData.get("parentId") || null,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.parentId) {
    const parent = await db.task.findUnique({
      where: { id: parsed.data.parentId },
    });
    if (!parent || parent.projectId !== projectId)
      throw new Error("Invalid parent task");
  }

  // Read-then-append in one transaction (TOCTOU guard, same as createProject).
  await db.$transaction(async (tx) => {
    const last = await tx.task.findFirst({
      where: { projectId, status: parsed.data.status },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const report = await tx.task.create({
      data: {
        projectId,
        completedAt: parsed.data.status === "DONE" ? new Date() : null,
        reportUrl: parsed.data.reportUrl,
        estimatedHours: parsed.data.estimatedHours,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        priority: parsed.data.priority,
        storyPoints: parsed.data.storyPoints ?? null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        assigneeId: parsed.data.assigneeId ?? null,
        reporterId: user.id,
        parentId: parsed.data.parentId ?? null,
        orderIndex: last ? last.orderIndex + ORDER_STEP : 0,
      },
    });
    await recordAudit(
      tx,
      user,
      "Report created",
      "Report",
      report.id,
      projectId,
      null,
      report,
    );
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/board");
  revalidatePath("/dashboard");
}

export async function updateTask(taskId: string, formData: FormData) {
  const me = await requireSession();
  // RBAC: project editor, or the task's reporter/assignee (mirrors moveTask).
  // This action previously only checked the session, letting any signed-in
  // user edit any task (OH-08).
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { members: { select: { id: true } } } } },
  });
  if (!task) throw new Error("Task not found");
  const taskOwnership = task.reporterId === me.id || task.assigneeId === me.id;
  const projectEditAllowed = canEditProject({
    viewerRole: me.role,
    viewerId: me.id,
    ownerId: task.project.ownerId,
    coOwnerId: task.project.coOwnerId,
    memberIds: task.project.members.map((m) => m.id),
  });
  if (!projectEditAllowed && !taskOwnership) throw new Error("Forbidden");

  const parsed = reportUpdateSchema.safeParse({
    ...(formData.has("expectedVersion") && {
      expectedVersion: formData.get("expectedVersion"),
    }),
    ...(formData.has("reportUrl") && { reportUrl: formData.get("reportUrl") }),
    ...(formData.has("estimatedHours") && {
      estimatedHours: formData.get("estimatedHours"),
    }),
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    storyPoints: formData.has("storyPoints")
      ? formData.get("storyPoints") || null
      : undefined,
    dueDate: formData.get("dueDate") ?? undefined,
    assigneeId: formData.has("assigneeId")
      ? formData.get("assigneeId") || null
      : undefined,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (
    parsed.data.assigneeId !== undefined &&
    parsed.data.assigneeId !== task.assigneeId &&
    !projectEditAllowed &&
    task.reporterId !== me.id
  )
    throw new Error(
      "Only the reporter or a project editor can reassign this report",
    );
  if (
    parsed.data.expectedVersion !== undefined &&
    parsed.data.expectedVersion !== task.version
  )
    throw new Error("This report changed elsewhere. Reload before saving.");
  const completing = parsed.data.status === "DONE" && task.status !== "DONE";
  const reopening =
    parsed.data.status &&
    parsed.data.status !== "DONE" &&
    task.status === "DONE";

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    data.description = parsed.data.description ?? null;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.storyPoints !== undefined)
    data.storyPoints = parsed.data.storyPoints ?? null;
  if (parsed.data.dueDate !== undefined)
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.assigneeId !== undefined)
    data.assigneeId =
      parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
  if (completing) data.completedAt = new Date();
  if (reopening) data.completedAt = null;

  if (parsed.data.reportUrl !== undefined)
    data.reportUrl = parsed.data.reportUrl;
  if (parsed.data.estimatedHours !== undefined)
    data.estimatedHours = parsed.data.estimatedHours;
  await db.$transaction(async (tx) => {
    const after = await tx.task.update({
      where: { id: taskId, version: task.version },
      data: { ...data, version: { increment: 1 } },
    });
    await recordAudit(
      tx,
      me,
      "Report updated",
      "Report",
      taskId,
      task.projectId,
      task,
      after,
    );
  });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/board");
  revalidatePath("/dashboard");
}

export async function quickChangeTaskStatus(
  taskId: string,
  status: TaskStatus,
) {
  const user = await requireSession();
  const parsedStatus = TaskStatusEnum.safeParse(status);
  if (!parsedStatus.success) throw new Error("Invalid status");

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { members: { select: { id: true } } } } },
  });
  if (!task) throw new Error("Task not found");

  // RBAC: project editor, or the task's reporter/assignee (mirrors moveTask).
  const projectEditAllowed = canEditProject({
    viewerRole: user.role,
    viewerId: user.id,
    ownerId: task.project.ownerId,
    coOwnerId: task.project.coOwnerId,
    memberIds: task.project.members.map((m) => m.id),
  });
  const taskOwnership =
    task.reporterId === user.id || task.assigneeId === user.id;
  if (!projectEditAllowed && !taskOwnership) throw new Error("Forbidden");

  // Re-read status inside the transaction so the completedAt side-effect can't
  // be computed from a stale snapshot under concurrent status changes.
  await db.$transaction(async (tx) => {
    const fresh = await tx.task.findUnique({
      where: { id: taskId },
      select: { status: true, completedAt: true },
    });
    if (!fresh) throw new Error("Task not found");
    const completedAt =
      status === "DONE"
        ? new Date()
        : fresh.status === "DONE"
          ? null
          : fresh.completedAt;
    const after = await tx.task.update({
      where: { id: taskId },
      data: { status, completedAt, version: { increment: 1 } },
    });
    await recordAudit(
      tx,
      user,
      "Report status changed",
      "Report",
      taskId,
      task.projectId,
      task,
      after,
    );
  });

  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/board");
  revalidatePath("/dashboard");
}

export type MoveTaskArgs = {
  taskId: string;
  toStatus: TaskStatus;
  targetCardId?: string | null;
  placement?: Placement;
  // optional: when swimlanes are enabled, reassign on lane drop
  toAssigneeId?: string | null;
};

export async function moveTask(args: MoveTaskArgs) {
  const user = await requireSession();
  const parsed = moveTaskSchema.safeParse(args);
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid move");
  const { taskId, toStatus } = parsed.data;
  let targetCardId = parsed.data.targetCardId ?? null;
  const placement: Placement = parsed.data.placement ?? "below";
  const reassign = parsed.data.toAssigneeId !== undefined;

  let projectId = "";
  await db.$transaction(
    async (tx) => {
      // RBAC re-checked with fresh data INSIDE the transaction (reporter/assignee
      // or membership can change mid-drag).
      const task = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          project: { include: { members: { select: { id: true } } } },
        },
      });
      if (!task) throw new Error("Task not found");
      projectId = task.projectId;

      const projectEditAllowed = canEditProject({
        viewerRole: user.role,
        viewerId: user.id,
        ownerId: task.project.ownerId,
        coOwnerId: task.project.coOwnerId,
        memberIds: task.project.members.map((m) => m.id),
      });
      const taskOwnership =
        task.reporterId === user.id || task.assigneeId === user.id;
      if (!projectEditAllowed && !taskOwnership) {
        throw new Error("Forbidden");
      }

      const siblings = await tx.task.findMany({
        where: {
          projectId: task.projectId,
          status: toStatus,
          id: { not: taskId },
        },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true },
      });
      // Ignore a targetCardId that isn't in this project+column (stale/forged).
      if (targetCardId && !siblings.some((s) => s.id === targetCardId)) {
        targetCardId = null;
      }
      let before: Sibling | null = null;
      let after: Sibling | null = null;
      if (targetCardId) {
        ({ before, after } = neighbourOrderIndex(
          siblings,
          targetCardId,
          placement,
        ));
      }
      let newOrderIndex = midpoint(before, after, siblings);
      if (needsRebalance(before, after)) {
        await Promise.all(
          siblings.map((s, i) =>
            tx.task.update({
              where: { id: s.id },
              data: { orderIndex: i * ORDER_STEP },
            }),
          ),
        );
        const beforeIdx = before
          ? siblings.findIndex((s) => s.id === before.id)
          : -1;
        const afterIdx = after
          ? siblings.findIndex((s) => s.id === after.id)
          : -1;
        if (beforeIdx >= 0 && afterIdx >= 0) {
          newOrderIndex = (beforeIdx * ORDER_STEP + afterIdx * ORDER_STEP) / 2;
        } else if (beforeIdx >= 0) {
          newOrderIndex = beforeIdx * ORDER_STEP + ORDER_STEP / 2;
        } else if (afterIdx >= 0) {
          newOrderIndex = afterIdx * ORDER_STEP - ORDER_STEP / 2;
        } else {
          newOrderIndex = 0;
        }
      }

      const data: Prisma.TaskUpdateInput = {
        status: toStatus,
        orderIndex: newOrderIndex,
      };
      if (toStatus === "DONE" && task.status !== "DONE") {
        data.completedAt = new Date();
      } else if (toStatus !== "DONE" && task.status === "DONE") {
        data.completedAt = null;
      }
      if (reassign) {
        // Project editors or the reporter may reassign on lane drop
        if (!projectEditAllowed && task.reporterId !== user.id) {
          throw new Error(
            "Only the reporter or a project editor can reassign this task",
          );
        }
        data.assignee = parsed.data.toAssigneeId
          ? { connect: { id: parsed.data.toAssigneeId } }
          : { disconnect: true };
      }
      const reportAfter = await tx.task.update({
        where: { id: taskId },
        data: { ...data, version: { increment: 1 } },
      });
      await recordAudit(
        tx,
        user,
        "Report moved on board",
        "Report",
        taskId,
        task.projectId,
        task,
        reportAfter,
      );
    },
    { timeout: 15000 },
  );

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/board");
  revalidatePath("/dashboard");
}

export async function quickAssignTask(
  taskId: string,
  assigneeId: string | null,
) {
  const me = await requireSession();
  // RBAC: project editor or the reporter — previously any signed-in user could
  // reassign any task (IDOR).
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { members: { select: { id: true } } } } },
  });
  if (!task) throw new Error("Task not found");
  const projectEditAllowed = canEditProject({
    viewerRole: me.role,
    viewerId: me.id,
    ownerId: task.project.ownerId,
    coOwnerId: task.project.coOwnerId,
    memberIds: task.project.members.map((m) => m.id),
  });
  if (!projectEditAllowed && task.reporterId !== me.id)
    throw new Error("Forbidden");
  z.string().cuid().nullable().parse(assigneeId);
  await trackChild(
    me,
    task.projectId,
    "Report",
    "Report reassigned",
    task,
    (tx) =>
      tx.task.update({
        where: { id: taskId },
        data: { assigneeId: assigneeId || null, version: { increment: 1 } },
      }),
  );
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/board");
}

export async function deleteTask(taskId: string) {
  const me = await requireSession();
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  if (
    task.reporterId !== me.id &&
    task.assigneeId !== me.id &&
    !isManagerOrAbove(me.role)
  )
    throw new Error("Forbidden");
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });
    await recordAudit(
      tx,
      me,
      "Report deleted",
      "Report",
      taskId,
      task.projectId,
      task,
      null,
    );
  });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/reports/board");
}

// ---------------- Project favorites (pins) ----------------

export async function toggleProjectFavorite(projectId: string) {
  const user = await requireSession();
  await requireProjectEditor(user, projectId);
  const existing = await db.user.findUnique({
    where: { id: user.id },
    select: {
      favoriteProjects: { where: { id: projectId }, select: { id: true } },
    },
  });
  const isFav = (existing?.favoriteProjects.length ?? 0) > 0;
  await db.user.update({
    where: { id: user.id },
    data: {
      favoriteProjects: isFav
        ? { disconnect: { id: projectId } }
        : { connect: { id: projectId } },
    },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/board");
}

// ---------------- Project members ----------------

export async function setProjectMembers(projectId: string, userIds: string[]) {
  const user = await requireSession();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) throw new Error("Project not found");
  // Tighter than canEditProject — only the owner or a manager+ can change the
  // member roster. Regular members can edit project content but not membership.
  if (!isManagerOrAbove(user.role) && project.ownerId !== user.id) {
    throw new Error("Only the project owner or a manager can change members");
  }
  z.array(idSchema).max(200).parse(userIds);
  await db.$transaction((tx) =>
    reviseProject(
      tx,
      user,
      projectId,
      { members: { set: userIds.map((id) => ({ id })) } },
      "Project collaborators changed",
    ),
  );
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/board");
}

// ---------------- Pages (Notion wiki) ----------------

export async function createPageFromTemplate(templateKey: string) {
  const user = await requireSession();
  const { getTemplate } = await import("@/lib/pageTemplates");
  const tpl = getTemplate(templateKey);
  const siblingCount = await db.page.count({
    where: { parentId: null, archived: false },
  });
  const page = await db.page.create({
    data: {
      title: tpl.title,
      emoji: tpl.emoji,
      content: tpl.content as never,
      authorId: user.id,
      orderIndex: siblingCount,
    },
  });
  revalidatePath("/dashboard/pages");
  redirect(`/dashboard/pages/${page.id}`);
}

export async function createPage(formData: FormData) {
  const user = await requireSession();
  const parsed = pageCreateSchema.safeParse({
    title: formData.get("title") || "Untitled",
    emoji: formData.get("emoji") || null,
    parentId: formData.get("parentId") || null,
    content: null,
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const siblingCount = await db.page.count({
    where: { parentId: parsed.data.parentId ?? null, archived: false },
  });
  const page = await db.page.create({
    data: {
      title: parsed.data.title,
      emoji: parsed.data.emoji ?? null,
      parentId: parsed.data.parentId ?? null,
      authorId: user.id,
      orderIndex: siblingCount,
    },
  });
  revalidatePath("/dashboard/pages");
  redirect(`/dashboard/pages/${page.id}`);
}

export async function savePage(
  pageId: string,
  input: unknown,
): Promise<{ updatedAt: string } | { error: string; conflict: boolean }> {
  const user = await requireSession();
  await requirePageEditor(user, pageId);
  const parsed = pageSaveSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid page",
      conflict: false,
    };
  const { expectedUpdatedAt, ...data } = parsed.data;
  const expected = new Date(expectedUpdatedAt);
  const updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
  const result = await db.page.updateMany({
    where: {
      id: pageId,
      archived: false,
      updatedAt: expected,
      ...(!isManagerOrAbove(user.role) && { authorId: user.id }),
    },
    data: { ...data, content: data.content ?? [], updatedAt },
  });
  if (!result.count)
    return {
      error: "This page changed elsewhere. Reload before saving your draft.",
      conflict: true,
    };
  revalidatePath("/dashboard/pages");
  return { updatedAt: updatedAt.toISOString() };
}

export async function archivePage(pageId: string) {
  const me = await requireSession();
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) return;
  if (page.authorId !== me.id && !isManagerOrAbove(me.role))
    throw new Error("Forbidden");
  await db.page.update({ where: { id: pageId }, data: { archived: true } });
  revalidatePath("/dashboard/pages");
  redirect("/dashboard/pages");
}

export async function changeOwnPassword(formData: FormData) {
  const me = await requireSession();
  const current = formText(formData, "current");
  const next = formText(formData, "next");
  if (!current || !next) throw new Error("Both fields are required");
  if (next.length < 8)
    throw new Error("New password must be at least 8 characters");
  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user) throw new Error("Account missing");
  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) throw new Error("Current password is wrong");
  const passwordHash = await bcrypt.hash(next, 12);
  await db.user.update({ where: { id: me.id }, data: { passwordHash } });
  revalidatePath("/dashboard/settings");
}

// ---------------- Weekly planning and daily adjustments ----------------

function requirePlanOwner(user: { id: string }, plan: { userId: string }) {
  if (user.id !== plan.userId)
    throw new Error("Only the person doing the work can change their plan");
}
function checkTime(startTime: string, hours: number) {
  const [hour, minute] = startTime.split(":").map(Number);
  if (hour * 60 + minute + hours * 60 > 1440)
    throw new Error("Work must finish within the same day");
}
export async function saveWorkPlan(planId: string | null, fd: FormData) {
  const user = await requireSession();
  const parsed = workPlanSchema.parse({
    ...Object.fromEntries(fd),
    weekdays: fd.getAll("weekdays"),
  });
  if (dateKey(weekStart(new Date(parsed.weekStart))) !== parsed.weekStart)
    throw new Error("Choose the Sunday that starts the week");
  checkTime(parsed.startTime, parsed.hours);
  await requireProjectEditor(user, parsed.projectId);
  await db.$transaction(async (tx) => {
    const before = planId
      ? await tx.workPlan.findUnique({ where: { id: idSchema.parse(planId) } })
      : null;
    if (planId && !before) throw new Error("Plan not found");
    if (before) requirePlanOwner(user, before);
    const { expectedVersion, weekStart: start, ...fields } = parsed;
    if (before && expectedVersion !== before.version)
      throw new Error("This plan changed elsewhere. Reload before saving.");
    const after = before
      ? await tx.workPlan.update({
          where: { id: before.id, version: before.version },
          data: { ...fields, version: { increment: 1 } },
        })
      : await tx.workPlan.create({
          data: { ...fields, weekStart: new Date(start), userId: user.id },
        });
    await recordAudit(
      tx,
      user,
      before ? "Weekly plan updated" : "Weekly plan created",
      "WorkPlan",
      after.id,
      after.projectId,
      before,
      after,
    );
  });
  refreshWorkspace();
}
export async function deleteWorkPlan(id: string, expectedVersion: number) {
  const user = await requireSession();
  idSchema.parse(id);
  z.number().int().positive().parse(expectedVersion);
  await db.$transaction(async (tx) => {
    const before = await tx.workPlan.findUniqueOrThrow({ where: { id } });
    requirePlanOwner(user, before);
    await tx.workPlan.delete({ where: { id, version: expectedVersion } });
    await recordAudit(
      tx,
      user,
      "Weekly plan removed",
      "WorkPlan",
      id,
      before.projectId,
      before,
      null,
    );
  });
  refreshWorkspace();
}
export async function saveDailyOverride(planId: string, fd: FormData) {
  const user = await requireSession();
  idSchema.parse(planId);
  const input = dailyOverrideSchema.parse({
    ...Object.fromEntries(fd),
    skipped: fd.get("skipped") === "on",
    note: fd.get("note") || null,
    expectedUpdatedAt: fd.get("expectedUpdatedAt") || null,
  });
  checkTime(input.startTime, input.hours);
  await requireProjectEditor(user, input.projectId);
  await db.$transaction(
    async (tx) => {
      const plan = await tx.workPlan.findUniqueOrThrow({
        where: { id: planId },
      });
      requirePlanOwner(user, plan);
      const date = new Date(input.date);
      if (
        date < plan.weekStart ||
        date >= addDays(plan.weekStart, 7) ||
        !plan.weekdays.includes(date.getUTCDay())
      )
        throw new Error("This day is outside the weekly plan");
      const before = await tx.dailyOverride.findUnique({
        where: { planId_date: { planId, date } },
      });
      if ((before?.updatedAt.toISOString() ?? null) !== input.expectedUpdatedAt)
        throw new Error("This day changed elsewhere. Reload before saving.");
      const { expectedUpdatedAt, ...fields } = input;
      void expectedUpdatedAt;
      const data = { ...fields, date };
      const after = await tx.dailyOverride.upsert({
        where: { planId_date: { planId, date } },
        create: { ...data, planId },
        update: data,
      });
      await recordAudit(
        tx,
        user,
        input.skipped ? "Planned day skipped" : "Daily work adjusted",
        "DailyOverride",
        after.id,
        input.projectId,
        before ?? plan,
        after,
      );
    },
    { isolationLevel: "Serializable" },
  );
  refreshWorkspace();
}
export async function resetDailyOverride(id: string, updatedAt: string) {
  const user = await requireSession();
  idSchema.parse(id);
  z.iso.datetime().parse(updatedAt);
  await db.$transaction(async (tx) => {
    const before = await tx.dailyOverride.findUniqueOrThrow({
      where: { id },
      include: { plan: true },
    });
    requirePlanOwner(user, before.plan);
    await tx.dailyOverride.delete({
      where: { id, updatedAt: new Date(updatedAt) },
    });
    await recordAudit(
      tx,
      user,
      "Daily work reset to weekly plan",
      "DailyOverride",
      id,
      before.projectId,
      before,
      before.plan,
    );
  });
  refreshWorkspace();
}
export async function copyPreviousWeek(week: string) {
  const user = await requireSession();
  z.iso.date().parse(week);
  const start = weekStart(new Date(week));
  await db.$transaction(
    async (tx) => {
      if (
        await tx.workPlan.count({
          where: { userId: user.id, weekStart: start },
        })
      )
        throw new Error(
          "This week already has a plan. Edit the existing plan instead.",
        );
      const previous = await tx.workPlan.findMany({
        where: {
          userId: user.id,
          weekStart: addDays(start, -7),
          project: {
            AND: [projectAccessWhere(user)],
            status: { not: "ARCHIVED" },
          },
        },
      });
      if (!previous.length)
        throw new Error("There is no plan in the previous week to copy");
      for (const plan of previous) {
        const after = await tx.workPlan.create({
          data: {
            userId: user.id,
            projectId: plan.projectId,
            weekStart: start,
            title: plan.title,
            weekdays: plan.weekdays,
            hours: plan.hours,
            startTime: plan.startTime,
          },
        });
        await recordAudit(
          tx,
          user,
          "Previous week copied",
          "WorkPlan",
          after.id,
          after.projectId,
          null,
          after,
        );
      }
    },
    { isolationLevel: "Serializable" },
  );
  refreshWorkspace();
}

// ---------------- Manager intake links and request pool ----------------

async function requireManager() {
  const user = await requireSession();
  if (!isManagerOrAbove(user.role)) throw new Error("Managers only");
  return user;
}
export async function createRequestLink(fd: FormData): Promise<void> {
  const user = await requireManager();
  const parsed = requestLinkSchema.parse(Object.fromEntries(fd));
  await db.requestLink.create({
    data: {
      label: parsed.label,
      recipientEmail: parsed.recipientEmail?.toLowerCase() ?? null,
      token: randomBytes(32).toString("hex"),
      managerId: user.id,
      expiresAt: addDays(new Date(), parsed.days),
    },
  });
  refreshWorkspace();
}
export async function revokeRequestLink(id: string) {
  const user = await requireManager();
  idSchema.parse(id);
  const link = await db.requestLink.findUniqueOrThrow({ where: { id } });
  if (link.managerId !== user.id && !isAdmin(user.role))
    throw new Error(
      "Only the creator or an administrator can revoke this link",
    );
  await db.requestLink.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  refreshWorkspace();
}
export async function submitProjectRequest(
  token: string,
  fd: FormData,
): Promise<{ ok: true } | { error: string }> {
  const tokenCheck = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .safeParse(token);
  if (!tokenCheck.success || formText(fd, "website"))
    return { error: "Invalid request" };
  const parsed = publicRequestSchema.safeParse({
    ...Object.fromEntries(fd),
    existingProject: fd.get("existingProject") || null,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    await db.$transaction(
      async (tx) => {
        const link = await tx.requestLink.findUnique({
          where: { token },
          include: { manager: { select: { active: true, role: true } } },
        });
        if (
          !link ||
          link.revokedAt ||
          link.expiresAt <= new Date() ||
          !link.manager.active ||
          !isManagerOrAbove(link.manager.role)
        )
          throw new Error("This form link is no longer available");
        if (
          link.recipientEmail &&
          link.recipientEmail !== parsed.data.submitterEmail.toLowerCase()
        )
          throw new Error("Use the email address this form was prepared for");
        const recent = await tx.projectRequest.count({
          where: {
            linkId: link.id,
            createdAt: { gt: new Date(Date.now() - 3600_000) },
          },
        });
        if (recent >= 20)
          throw new Error(
            "This link has received many requests. Try again later or contact the manager.",
          );
        // Repeated clicks do not create duplicate requests.
        const duplicate = await tx.projectRequest.findFirst({
          where: {
            linkId: link.id,
            submitterEmail: parsed.data.submitterEmail.toLowerCase(),
            title: parsed.data.title,
            description: parsed.data.description,
            createdAt: { gt: new Date(Date.now() - 300_000) },
          },
        });
        if (!duplicate)
          await tx.projectRequest.create({
            data: {
              ...parsed.data,
              requestedDate: parsed.data.requestedDate
                ? new Date(parsed.data.requestedDate)
                : null,
              submitterEmail: parsed.data.submitterEmail.toLowerCase(),
              linkId: link.id,
            },
          });
      },
      { isolationLevel: "Serializable" },
    );
    refreshWorkspace();
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error && !error.message.includes("Prisma")
          ? error.message
          : "Could not submit the form. Please try again.",
    };
  }
}
export async function decideProjectRequest(fd: FormData) {
  const user = await requireManager();
  const parsed = requestDecisionSchema.parse({
    ...Object.fromEntries(fd),
    ownerId: fd.get("ownerId") || null,
    sourceProjectId: fd.get("sourceProjectId") || null,
    notes: fd.get("notes") || "",
  });
  if (parsed.decision === "ASSIGN" && !parsed.ownerId)
    throw new Error("Choose a project owner before assigning");
  if (parsed.ownerId)
    await checkProjectPeople(
      user,
      parsed.ownerId,
      null,
      parsed.sourceProjectId,
    );
  await db.$transaction(
    async (tx) => {
      const request = await tx.projectRequest.findUniqueOrThrow({
        where: { id: parsed.requestId },
      });
      if (request.projectId)
        throw new Error(
          "This request has already been assigned. Open its project to make changes.",
        );
      if (request.version !== parsed.expectedVersion)
        throw new Error(
          "This request changed elsewhere. Reload before saving.",
        );
      let projectId: string | null = null;
      if (parsed.decision === "ASSIGN" && parsed.ownerId) {
        const project = await tx.project.create({
          data: {
            title: request.title,
            summary: request.description.slice(0, 500),
            description: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: request.description, styles: {} },
                ],
              },
            ],
            ownerId: parsed.ownerId,
            projectType: request.projectType,
            sourceProjectId: parsed.sourceProjectId,
            estimatedHours: request.estimatedHours,
            savedHours: request.savedHours,
            targetDate: request.requestedDate,
            priority: request.priority,
          },
        });
        projectId = project.id;
        await saveProjectRevision(
          tx,
          project.id,
          user,
          "Created from manager request pool",
        );
        await recordAudit(
          tx,
          user,
          "Request assigned as project",
          "Project",
          project.id,
          project.id,
          null,
          project,
        );
      }
      const after = await tx.projectRequest.update({
        where: { id: request.id, version: request.version },
        data: {
          status:
            parsed.decision === "ASSIGN"
              ? "ASSIGNED"
              : parsed.decision === "REJECT"
                ? "REJECTED"
                : "PENDING",
          managerNotes: parsed.notes,
          projectId,
          version: { increment: 1 },
        },
      });
      await recordAudit(
        tx,
        user,
        "Request reviewed",
        "ProjectRequest",
        request.id,
        projectId,
        request,
        after,
      );
    },
    { isolationLevel: "Serializable" },
  );
  refreshWorkspace();
}

// ---------------- Fiscal configuration and project version restore ----------------

export async function saveFiscalConfig(fd: FormData) {
  const user = await requireManager();
  const parsed = fiscalConfigSchema.parse(Object.fromEntries(fd));
  if (new Date(parsed.startDate).getUTCDay() !== 0)
    throw new Error("The fiscal year must start on Sunday");
  await db.fiscalYearConfig.upsert({
    where: { year: parsed.year },
    create: { ...parsed, startDate: new Date(parsed.startDate) },
    update: { startDate: new Date(parsed.startDate), weeks: parsed.weeks },
  });
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "Fiscal calendar configured",
      entity: "FiscalYearConfig",
      entityId: String(parsed.year),
      meta: parsed,
    },
  });
  refreshWorkspace();
}
export async function restoreProjectRevision(projectId: string, fd: FormData) {
  const user = await requireSession();
  const current = await requireProjectEditor(user, projectId);
  if (current.ownerId !== user.id && !isManagerOrAbove(user.role))
    throw new Error(
      "Only the owner or a manager can restore a project version",
    );
  const input = restoreRevisionSchema.parse(Object.fromEntries(fd));
  const revision = await db.projectRevision.findUniqueOrThrow({
    where: { id: input.revisionId, projectId },
  });
  const snapshotSchema = workspaceProjectUpdateSchema.extend({
    actualEndDate: z.iso.datetime().nullable(),
    members: z.array(z.object({ id: idSchema })),
    tags: z.array(z.object({ id: idSchema })),
  });
  const parsed = snapshotSchema.parse(revision.snapshot);
  const {
    expectedVersion,
    ownerId,
    coOwnerId,
    sourceProjectId,
    description,
    startDate,
    targetDate,
    actualEndDate,
    members,
    tags,
    ...fields
  } = parsed;
  void expectedVersion;
  await checkProjectPeople(
    user,
    ownerId ?? current.ownerId,
    coOwnerId ?? null,
    sourceProjectId ?? null,
    projectId,
  );
  checkedRange(startDate, targetDate);
  await db.$transaction((tx) =>
    reviseProject(
      tx,
      user,
      projectId,
      {
        ...fields,
        actualEndDate: actualEndDate ? new Date(actualEndDate) : null,
        members: { set: members },
        tags: { set: tags },
        description: description ?? [],
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        owner: { connect: { id: ownerId ?? current.ownerId } },
        coOwner: coOwnerId
          ? { connect: { id: coOwnerId } }
          : { disconnect: true },
        sourceProject: sourceProjectId
          ? { connect: { id: sourceProjectId } }
          : { disconnect: true },
      },
      `Restored project details from version ${revision.version}`,
      input.expectedVersion,
    ),
  );
  refreshWorkspace(projectId);
}

export async function createReport(fd: FormData) {
  const projectId = idSchema.parse(fd.get("projectId"));
  await createTask(projectId, fd);
  refreshWorkspace(projectId);
}

export async function archiveProject(projectId: string) {
  idSchema.parse(projectId);
  await quickUpdateProjectStatus(projectId, "ARCHIVED");
}

export async function updateMilestone(
  id: string,
  projectId: string,
  fd: FormData,
) {
  const user = await requireSession();
  idSchema.parse(id);
  idSchema.parse(projectId);
  const before = await db.milestone.findUniqueOrThrow({
    where: { id, projectId },
  });
  await requireProjectEditor(user, before.projectId);
  const input = milestoneUpdateSchema.parse({
    title: fd.get("title"),
    dueDate: fd.get("dueDate"),
  });
  await trackChild(
    user,
    projectId,
    "Milestone",
    "Milestone details changed",
    before,
    (tx) =>
      tx.milestone.update({
        where: { id },
        data: {
          title: input.title,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      }),
  );
  refreshWorkspace(projectId);
}
