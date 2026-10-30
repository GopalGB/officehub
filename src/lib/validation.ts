import { z } from "zod";
import { additionalDetailsSchema } from "@/lib/additional-details";

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

const isoDate = z.preprocess(
  (value) => (value === "" ? null : value),
  z
    .union([z.iso.datetime({ offset: true }), z.iso.date()])
    .optional()
    .nullable(),
);

export const blockDocumentSchema = z
  .array(z.json())
  .max(5000)
  .refine(
    (blocks) =>
      blocks.every(
        (block) =>
          block !== null &&
          typeof block === "object" &&
          !Array.isArray(block) &&
          typeof block.type === "string",
      ),
    "Expected editor blocks",
  );

export const projectCreateSchema = z.object({
  title: z.string().min(2, "Title is too short").max(160),
  summary: z.string().max(500).optional().nullable(),
  description: blockDocumentSchema.optional().nullable(),
  status: ProjectStatusEnum.default("PLANNING"),
  priority: PriorityEnum.default("MEDIUM"),
  startDate: isoDate,
  targetDate: isoDate,
  ownerId: z.string().cuid().optional(),
  additionalDetails: additionalDetailsSchema.optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: ProjectStatusEnum.optional(),
  priority: PriorityEnum.optional(),
});
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const projectStatusUpdateSchema = z.object({
  content: blockDocumentSchema,
});

export const enhancementCreateSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().nullable(),
  status: EnhancementStatusEnum.default("PROPOSED"),
  priority: PriorityEnum.default("MEDIUM"),
});
export const enhancementUpdateSchema = enhancementCreateSchema
  .partial()
  .extend({
    status: EnhancementStatusEnum.optional(),
    priority: PriorityEnum.optional(),
  });

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

export const TaskStatusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "DONE",
]);

export const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  status: TaskStatusEnum.default("TODO"),
  priority: PriorityEnum.default("MEDIUM"),
  storyPoints: z.coerce.number().int().min(0).max(99).optional().nullable(),
  dueDate: isoDate,
  assigneeId: z.string().cuid().optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: TaskStatusEnum.optional(),
  priority: PriorityEnum.optional(),
});

// ---- Board drag-and-drop move payloads (client-supplied → must be validated) ----
export const placementEnum = z.enum(["above", "below"]);

export const moveProjectSchema = z.object({
  projectId: z.string().cuid(),
  toStatus: ProjectStatusEnum,
  targetCardId: z.string().cuid().nullable().optional(),
  placement: placementEnum.optional(),
});
export type MoveProjectInput = z.infer<typeof moveProjectSchema>;

export const moveTaskSchema = z.object({
  taskId: z.string().cuid(),
  toStatus: TaskStatusEnum,
  targetCardId: z.string().cuid().nullable().optional(),
  placement: placementEnum.optional(),
  toAssigneeId: z.string().cuid().nullable().optional(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const pageCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  emoji: z.string().max(8).optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  content: blockDocumentSchema.optional().nullable(),
});

export const pageUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  emoji: z.string().max(8).optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  content: blockDocumentSchema.optional().nullable(),
});

export const pageSaveSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  emoji: z.string().max(8).nullable(),
  content: blockDocumentSchema.nullable(),
  expectedUpdatedAt: z.iso.datetime(),
});

// Project workspace. Empty optional fields are stored as null, never as zero.
export const optionalHours = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.number().min(0).max(100000).nullable().optional(),
);
export const projectTypeEnum = z.enum([
  "NEW_PROJECT",
  "ENHANCEMENT",
  "SUPPORT",
]);
export const workspaceProjectFields = {
  ownerId: z.string().cuid().optional(),
  coOwnerId: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().cuid().nullable().optional(),
  ),
  projectType: projectTypeEnum.optional(),
  sourceProjectId: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().cuid().nullable().optional(),
  ),
  estimatedHours: optionalHours,
  savedHours: optionalHours,
  department: z.string().trim().max(100).nullable().optional(),
  subTeam: z.string().trim().max(100).nullable().optional(),
  acceptanceCriteria: z.string().trim().max(5000).nullable().optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
};
export const workspaceProjectCreateSchema = projectCreateSchema.extend(
  workspaceProjectFields,
);
export const workspaceProjectUpdateSchema = projectUpdateSchema.extend(
  workspaceProjectFields,
);
export const enhancementFields = {
  startDate: isoDate,
  targetDate: isoDate,
  releaseLabel: z.string().trim().max(50).nullable().optional(),
  estimatedHours: optionalHours,
  savedHours: optionalHours,
  expectedVersion: z.coerce.number().int().positive().optional(),
};
export const workspaceEnhancementCreateSchema =
  enhancementCreateSchema.extend(enhancementFields);
export const workspaceEnhancementUpdateSchema =
  enhancementUpdateSchema.extend(enhancementFields);
export const reportFields = {
  reportUrl: z.preprocess(
    (v) => (v === "" ? null : v),
    z
      .url()
      .max(2000)
      .refine((v) => /^https?:\/\//i.test(v), "Use an http or https URL")
      .nullable()
      .optional(),
  ),
  estimatedHours: optionalHours,
};
export const reportCreateSchema = taskCreateSchema.extend(reportFields);
export const reportUpdateSchema = taskUpdateSchema.extend({
  ...reportFields,
  expectedVersion: z.coerce.number().int().positive().optional(),
});
export const workPlanSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().trim().min(2).max(200),
  weekStart: z.iso.date(),
  weekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .transform((v) => [...new Set(v)]),
  hours: z.coerce.number().positive().max(24),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  expectedVersion: z.coerce.number().int().positive().optional(),
});
export const dailyOverrideSchema = z.object({
  date: z.iso.date(),
  projectId: z.string().cuid(),
  title: z.string().trim().min(2).max(200),
  hours: z.coerce.number().positive().max(24),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  skipped: z.boolean(),
  note: z.string().trim().max(1000).nullable(),
  expectedUpdatedAt: z.iso.datetime().nullable(),
});
export const requestLinkSchema = z.object({
  label: z.string().trim().min(2).max(120),
  recipientEmail: z.preprocess(
    (v) => (v === "" ? null : v),
    z.email().nullable(),
  ),
  days: z.coerce.number().int().min(1).max(90),
});
export const publicRequestSchema = z.object({
  subTeam: z.string().trim().max(100).optional().nullable(),
  submitterName: z.string().trim().min(2).max(100),
  submitterEmail: z.email().max(254),
  managerName: z.string().trim().min(2, "Enter your manager's name").max(100),
  department: z
    .string()
    .trim()
    .min(2, "Enter your team or department")
    .max(100),
  sopLocation: z.string().trim().max(2000).optional().nullable(),
  requiredFilesLocation: z.string().trim().max(2000).optional().nullable(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(5000),
  projectType: projectTypeEnum,
  existingProject: z.string().trim().max(200).nullable(),
  estimatedHours: z.coerce.number().positive().max(100000),
  savedHours: optionalHours,
  requestedDate: isoDate,
  priority: PriorityEnum,
});
export const requestDecisionSchema = z.object({
  requestId: z.string().cuid(),
  expectedVersion: z.coerce.number().int().positive(),
  decision: z.enum(["ASSIGN", "REJECT", "PENDING"]),
  ownerId: z.string().cuid().nullable(),
  sourceProjectId: z.string().cuid().nullable(),
  notes: z.string().trim().max(2000),
});
export const fiscalConfigSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  startDate: z.iso.date(),
  weeks: z.coerce.number().int().min(52).max(53),
});
export const idSchema = z.string().cuid();
export const restoreRevisionSchema = z.object({
  revisionId: idSchema,
  expectedVersion: z.coerce.number().int().positive(),
});
