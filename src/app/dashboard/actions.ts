"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "../../../auth";
import { db } from "@/lib/db";
import {
  commentCreateSchema,
  enhancementCreateSchema,
  enhancementUpdateSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  projectCreateSchema,
  projectStatusUpdateSchema,
  projectUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/validation";
import { canDeleteProject, canEditProject, isAdmin, isManagerOrAbove } from "@/lib/rbac";

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
  const existing = await db.project.findUnique({ where: { id: projectId } });
  if (!existing) throw new Error("Project not found");
  if (!canEditProject({ viewerRole: user.role, viewerId: user.id, ownerId: existing.ownerId })) {
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
