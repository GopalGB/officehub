"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import {
  commentCreateSchema,
  enhancementCreateSchema,
  enhancementUpdateSchema,
  inviteAcceptSchema,
  inviteCreateSchema,
  milestoneCreateSchema,
  pageCreateSchema,
  pageUpdateSchema,
  projectCreateSchema,
  projectStatusUpdateSchema,
  projectUpdateSchema,
  tagCreateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/validation";
import { generateInviteToken, inviteExpiry, inviteUrl } from "@/lib/invitations";
import { canDeleteProject, canEditProject, isAdmin, isManagerOrAbove } from "@/lib/rbac";
import type { ProjectStatus, TaskStatus } from "@prisma/client";

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

export async function createProject(formData: FormData) {
  const user = await requireSession();
  const parsed = projectCreateSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary") || null,
    description: parseJSON(formData.get("description")),
    status: formData.get("status") || "PLANNING",
    priority: formData.get("priority") || "MEDIUM",
    startDate: formData.get("startDate") || null,
    targetDate: formData.get("targetDate") || null,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const project = await db.project.create({
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      description: parsed.data.description ?? undefined,
      status: parsed.data.status,
      priority: parsed.data.priority,
      startDate: parseDate(formData.get("startDate")),
      targetDate: parseDate(formData.get("targetDate")),
      ownerId: user.id,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const user = await requireSession();
  const existing = await db.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { id: true } } },
  });
  if (!existing) throw new Error("Project not found");
  if (
    !canEditProject({
      viewerRole: user.role,
      viewerId: user.id,
      ownerId: existing.ownerId,
      memberIds: existing.members.map((m) => m.id),
    })
  ) {
    throw new Error("Forbidden");
  }

  const parsed = projectUpdateSchema.safeParse({
    title: formData.get("title") ?? undefined,
    summary: formData.get("summary") ?? undefined,
    description: parseJSON(formData.get("description")),
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    startDate: formData.get("startDate") ?? undefined,
    targetDate: formData.get("targetDate") ?? undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await db.project.update({
    where: { id: projectId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.summary !== undefined && { summary: parsed.data.summary ?? null }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description ?? undefined }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
      startDate: parseDate(formData.get("startDate")),
      targetDate: parseDate(formData.get("targetDate")),
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
}

export async function deleteProject(projectId: string) {
  const user = await requireSession();
  const existing = await db.project.findUnique({ where: { id: projectId } });
  if (!existing) throw new Error("Project not found");
  if (!canDeleteProject({ viewerRole: user.role, viewerId: user.id, ownerId: existing.ownerId })) {
    throw new Error("Forbidden");
  }
  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  redirect("/dashboard");
}

// ---------------- Project Updates ----------------

export async function addProjectUpdate(projectId: string, formData: FormData) {
  const user = await requireSession();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const parsed = projectStatusUpdateSchema.safeParse({
    content: parseJSON(formData.get("content")),
  });
  if (!parsed.success || !parsed.data.content) throw new Error("Update body is required");

  await db.projectUpdate.create({
    data: {
      projectId,
      authorId: user.id,
      content: parsed.data.content,
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Enhancements ----------------

export async function addEnhancement(projectId: string, formData: FormData) {
  const user = await requireSession();
  const parsed = enhancementCreateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status") || "PROPOSED",
    priority: formData.get("priority") || "MEDIUM",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await db.enhancement.create({
    data: { ...parsed.data, projectId, authorId: user.id },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function updateEnhancement(id: string, projectId: string, formData: FormData) {
  await requireSession();
  const parsed = enhancementUpdateSchema.safeParse({
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await db.enhancement.update({ where: { id }, data: parsed.data });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteEnhancement(id: string, projectId: string) {
  const user = await requireSession();
  const existing = await db.enhancement.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.authorId !== user.id && !isManagerOrAbove(user.role)) throw new Error("Forbidden");
  await db.enhancement.delete({ where: { id } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Milestones ----------------

export async function addMilestone(projectId: string, formData: FormData) {
  await requireSession();
  const parsed = milestoneCreateSchema.safeParse({
    title: formData.get("title"),
    dueDate: formData.get("dueDate") || null,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const count = await db.milestone.count({ where: { projectId } });
  await db.milestone.create({
    data: {
      projectId,
      title: parsed.data.title,
      dueDate: parseDate(formData.get("dueDate")),
      orderIndex: count,
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function toggleMilestone(id: string, projectId: string, completed: boolean) {
  await requireSession();
  await db.milestone.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteMilestone(id: string, projectId: string) {
  await requireSession();
  await db.milestone.delete({ where: { id } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Comments ----------------

export async function addComment(projectId: string, formData: FormData) {
  const user = await requireSession();
  const parsed = commentCreateSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await db.comment.create({
    data: { projectId, authorId: user.id, content: parsed.data.content },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteComment(id: string, projectId: string) {
  const user = await requireSession();
  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.authorId !== user.id && !isManagerOrAbove(user.role)) throw new Error("Forbidden");
  await db.comment.delete({ where: { id } });
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
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
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
    active: formData.get("active") === "true" ? true : formData.get("active") === "false" ? false : undefined,
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.update({ where: { id: userId }, data });
  revalidatePath("/dashboard/team");
}

// ---------------- Invitations ----------------

export async function createInvitation(formData: FormData): Promise<{ url: string; email: string } | { error: string }> {
  const me = await requireSession();
  if (!isAdmin(me.role)) return { error: "Admin only" };
  const parsed = inviteCreateSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || "MEMBER",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

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
  if (invite.acceptedAt) return { error: "This invitation has already been used" };
  if (invite.expiresAt < new Date()) return { error: "This invitation has expired" };

  const existing = await db.user.findUnique({ where: { email: invite.email } });
  if (existing) return { error: "An account with this email already exists. Sign in instead." };

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
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
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
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    throw new Error("Forbidden");
  }
  await db.project.update({
    where: { id: projectId },
    data: { tags: { set: tagIds.map((id) => ({ id })) } },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/board");
  revalidatePath("/dashboard/manager");
}

// ---------------- Inline quick edits ----------------

export async function quickUpdateProjectStatus(projectId: string, status: ProjectStatus) {
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
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    throw new Error("Forbidden");
  }
  await db.project.update({
    where: { id: projectId },
    data: {
      status,
      actualEndDate: status === "COMPLETED" ? new Date() : null,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/board");
  revalidatePath(`/dashboard/projects/${projectId}`);
}

// ---------------- Tasks ----------------

export async function createTask(projectId: string, formData: FormData) {
  const user = await requireSession();
  const parsed = taskCreateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status") || "TODO",
    priority: formData.get("priority") || "MEDIUM",
    storyPoints: formData.get("storyPoints") || undefined,
    dueDate: formData.get("dueDate") || null,
    assigneeId: formData.get("assigneeId") || null,
    parentId: formData.get("parentId") || null,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const count = await db.task.count({ where: { projectId } });
  await db.task.create({
    data: {
      projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      storyPoints: parsed.data.storyPoints ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeId: parsed.data.assigneeId ?? null,
      reporterId: user.id,
      parentId: parsed.data.parentId ?? null,
      orderIndex: count,
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/board");
  revalidatePath("/dashboard");
}

export async function updateTask(taskId: string, formData: FormData) {
  await requireSession();
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");

  const parsed = taskUpdateSchema.safeParse({
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    status: formData.get("status") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    storyPoints: formData.get("storyPoints") || undefined,
    dueDate: formData.get("dueDate") ?? undefined,
    assigneeId: formData.get("assigneeId") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const completing = parsed.data.status === "DONE" && task.status !== "DONE";
  const reopening = parsed.data.status && parsed.data.status !== "DONE" && task.status === "DONE";

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description ?? null;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.storyPoints !== undefined) data.storyPoints = parsed.data.storyPoints ?? null;
  if (parsed.data.dueDate !== undefined)
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.assigneeId !== undefined)
    data.assigneeId = parsed.data.assigneeId === "" ? null : parsed.data.assigneeId;
  if (completing) data.completedAt = new Date();
  if (reopening) data.completedAt = null;

  await db.task.update({ where: { id: taskId }, data });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/board");
  revalidatePath("/dashboard");
}

export async function quickChangeTaskStatus(taskId: string, status: TaskStatus) {
  await requireSession();
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  await db.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : task.status === "DONE" ? null : task.completedAt,
    },
  });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/board");
  revalidatePath("/dashboard");
}

export async function quickAssignTask(taskId: string, assigneeId: string | null) {
  await requireSession();
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  await db.task.update({
    where: { id: taskId },
    data: { assigneeId: assigneeId || null },
  });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/board");
}

export async function deleteTask(taskId: string) {
  const me = await requireSession();
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  if (task.reporterId !== me.id && !isManagerOrAbove(me.role)) throw new Error("Forbidden");
  await db.task.delete({ where: { id: taskId } });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/board");
}

// ---------------- Project favorites (pins) ----------------

export async function toggleProjectFavorite(projectId: string) {
  const user = await requireSession();
  const existing = await db.user.findUnique({
    where: { id: user.id },
    select: { favoriteProjects: { where: { id: projectId }, select: { id: true } } },
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
  await db.project.update({
    where: { id: projectId },
    data: { members: { set: userIds.map((id) => ({ id })) } },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/board");
}

// ---------------- Pages (Notion wiki) ----------------

export async function createPageFromTemplate(templateKey: string) {
  const user = await requireSession();
  const { getTemplate } = await import("@/lib/pageTemplates");
  const tpl = getTemplate(templateKey);
  const siblingCount = await db.page.count({ where: { parentId: null, archived: false } });
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
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

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

export async function updatePage(pageId: string, formData: FormData) {
  await requireSession();
  const parsed = pageUpdateSchema.safeParse({
    title: formData.get("title") ?? undefined,
    emoji: formData.get("emoji") ?? undefined,
    parentId: formData.get("parentId") ?? undefined,
    content: formData.get("content") ? parseJSON(formData.get("content")) ?? undefined : undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.emoji !== undefined) data.emoji = parsed.data.emoji ?? null;
  if (parsed.data.parentId !== undefined) data.parentId = parsed.data.parentId ?? null;
  if (parsed.data.content !== undefined) data.content = parsed.data.content ?? null;

  await db.page.update({ where: { id: pageId }, data });
  revalidatePath("/dashboard/pages");
  revalidatePath(`/dashboard/pages/${pageId}`);
}

export async function savePageContent(pageId: string, content: unknown) {
  await requireSession();
  await db.page.update({ where: { id: pageId }, data: { content: content as never } });
  revalidatePath(`/dashboard/pages/${pageId}`);
}

export async function archivePage(pageId: string) {
  const me = await requireSession();
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) return;
  if (page.authorId !== me.id && !isManagerOrAbove(me.role)) throw new Error("Forbidden");
  await db.page.update({ where: { id: pageId }, data: { archived: true } });
  revalidatePath("/dashboard/pages");
  redirect("/dashboard/pages");
}

export async function changeOwnPassword(formData: FormData) {
  const me = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!current || !next) throw new Error("Both fields are required");
  if (next.length < 8) throw new Error("New password must be at least 8 characters");
  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user) throw new Error("Account missing");
  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) throw new Error("Current password is wrong");
  const passwordHash = await bcrypt.hash(next, 12);
  await db.user.update({ where: { id: me.id }, data: { passwordHash } });
  revalidatePath("/dashboard/settings");
}
