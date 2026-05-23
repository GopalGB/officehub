import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(2, "Name is too short").max(80),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Too long")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[0-9]/, "Add a number"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const ProjectStatusEnum = z.enum([
  "PLANNING",
  "IN_PROGRESS",
  "BLOCKED",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
]);
export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const EnhancementStatusEnum = z.enum([
  "PROPOSED",
  "APPROVED",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
]);
export const RoleEnum = z.enum(["ADMIN", "MANAGER", "MEMBER"]);

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional()
  .nullable();

export const projectCreateSchema = z.object({
  title: z.string().min(2, "Title is too short").max(160),
  summary: z.string().max(500).optional().nullable(),
  description: z.any().optional().nullable(),
  status: ProjectStatusEnum.default("PLANNING"),
  priority: PriorityEnum.default("MEDIUM"),
  startDate: isoDate,
  targetDate: isoDate,
  ownerId: z.string().cuid().optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial();
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const projectStatusUpdateSchema = z.object({
  content: z.any(),
});

export const enhancementCreateSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().nullable(),
  status: EnhancementStatusEnum.default("PROPOSED"),
  priority: PriorityEnum.default("MEDIUM"),
});
export const enhancementUpdateSchema = enhancementCreateSchema.partial();

export const milestoneCreateSchema = z.object({
  title: z.string().min(2).max(160),
  dueDate: isoDate,
});
export const milestoneUpdateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  dueDate: isoDate,
  completed: z.boolean().optional(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(8).max(128),
  role: RoleEnum.default("MEMBER"),
});
export const userUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: RoleEnum.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const inviteCreateSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: RoleEnum.default("MEMBER"),
});
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

export const inviteAcceptSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[0-9]/, "Add a number"),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #94a3b8")
    .optional(),
});
