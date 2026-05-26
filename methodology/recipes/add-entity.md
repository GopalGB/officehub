# Recipe: Add an entity end-to-end

The single most-copied recipe in OfficeHub. Following this exactly takes ~45 minutes for a small entity, ~2 hours for one with relations + UI surface area.

Worked example: adding **`Sprint`** — groups tasks into time-boxed iterations.

This recipe maps to the 7-phase [GSD Playbook](../../docs/GSD-PLAYBOOK.md). Each "Step" below is one commit.

---

## Phase 1: Goal (5 min, 1 commit)

```
git checkout -b feat/sprints
mkdir -p .planning/sprints
```

Write `.planning/sprints/GOAL.md`:
```markdown
# Goal: Sprints

## Why
Teams need to time-box task groups (2-week iterations) and ask "how much did we ship this sprint?"

## Success looks like
- [ ] User can create a sprint with name + start + end dates on a project
- [ ] User can assign existing tasks to a sprint
- [ ] Project page shows "Active sprint" with task progress

## Non-goals
- Not doing: burndown charts (v2)
- Not doing: sprint retrospective workflow (v2)
- Not doing: cross-project sprints (sprints are project-scoped)

## Touches
- Schema: Sprint model + Task.sprintId
- API: /api/projects/:id/sprints (later)
- UI: project detail page sprint section
- Auth: same as Task RBAC (owner / member / manager+)
```

```
git add .planning/sprints/GOAL.md
git commit -m "docs(sprints): goal"
```

## Phase 2: Plan (15 min, 1 commit)

Write `.planning/sprints/PLAN.md`:

```markdown
# Plan: Sprints

## File-by-file diff
- prisma/schema.prisma — Sprint model + Task.sprintId relation
- src/lib/validation.ts — sprintCreateSchema, sprintUpdateSchema
- src/app/dashboard/actions.ts — createSprint, updateSprint, deleteSprint, assignTaskToSprint
- src/components/sprint/SprintQuickAdd.tsx — new (client)
- src/components/sprint/SprintList.tsx — new (server with client child)
- src/app/dashboard/projects/[id]/page.tsx — render <SprintList> above tasks
- docs/ARCHITECTURE.md — append Sprint to data model section

## Pattern map
- Schema like Milestone (project-scoped, dates, lifecycle).
- UI quick-add like TaskQuickAdd (inline form).
- Task assignment to sprint like Task.assigneeId pattern.

## Risks
- R1: Task already has `parentId` for subtasks — adding `sprintId` is unrelated, no collision.
- R2: Existing tasks get `sprintId = null` (backfill-safe).

## Verification
- Create sprint with end > start (success) and end < start (validation rejects).
- Assign 3 tasks; sprint list shows count "3 tasks".
- Member of project can create sprint; non-member cannot.
```

```
git add .planning/sprints/PLAN.md
git commit -m "docs(sprints): plan"
```

## Phase 3: Execute

### Step 3a: Schema (1 commit)

`prisma/schema.prisma`:
```prisma
model Sprint {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  startDate DateTime
  endDate   DateTime
  goal      String?
  tasks     Task[]   @relation("SprintTasks")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([projectId])
}
```

Update `Task`:
```prisma
sprintId String?
sprint   Sprint? @relation("SprintTasks", fields: [sprintId], references: [id], onDelete: SetNull)
@@index([sprintId])
```

Update `Project`:
```prisma
sprints  Sprint[]
```

Apply:
```bash
npx prisma db push
npx prisma generate
```

Commit:
```bash
git add prisma/schema.prisma
git commit -m "feat(schema): Sprint model with Task.sprintId relation"
```

### Step 3b: Validation (1 commit)

`src/lib/validation.ts` — append:

```typescript
export const sprintCreateSchema = z
  .object({
    name: z.string().min(1).max(80),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    goal: z.string().max(500).optional().nullable(),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const sprintUpdateSchema = sprintCreateSchema.partial();

export const assignTaskToSprintSchema = z.object({
  taskId: z.string().cuid(),
  sprintId: z.string().cuid().nullable(),
});
```

```bash
git add src/lib/validation.ts
git commit -m "feat(validation): sprint schemas"
```

### Step 3c: Server actions (1 commit)

`src/app/dashboard/actions.ts` — append a new section:

```typescript
// ---------------- Sprints ----------------

export async function createSprint(projectId: string, formData: FormData) {
  const user = await requireSession();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { id: true } } },
  });
  if (!project) throw new Error("Project not found");
  if (!canEditProject({
    viewerRole: user.role, viewerId: user.id,
    ownerId: project.ownerId,
    memberIds: project.members.map((m) => m.id),
  })) throw new Error("Forbidden");

  const parsed = sprintCreateSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    goal: formData.get("goal") || null,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await db.sprint.create({
    data: {
      ...parsed.data,
      projectId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteSprint(sprintId: string) {
  const user = await requireSession();
  const sprint = await db.sprint.findUnique({
    where: { id: sprintId },
    include: { project: { include: { members: { select: { id: true } } } } },
  });
  if (!sprint) throw new Error("Sprint not found");
  if (!canEditProject({
    viewerRole: user.role, viewerId: user.id,
    ownerId: sprint.project.ownerId,
    memberIds: sprint.project.members.map((m) => m.id),
  })) throw new Error("Forbidden");
  await db.sprint.delete({ where: { id: sprintId } });
  revalidatePath(`/dashboard/projects/${sprint.projectId}`);
}

export async function assignTaskToSprint(taskId: string, sprintId: string | null) {
  const user = await requireSession();
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { members: { select: { id: true } } } } },
  });
  if (!task) throw new Error("Task not found");
  if (!canEditProject({
    viewerRole: user.role, viewerId: user.id,
    ownerId: task.project.ownerId,
    memberIds: task.project.members.map((m) => m.id),
  })) throw new Error("Forbidden");
  await db.task.update({ where: { id: taskId }, data: { sprintId } });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
}
```

```bash
git add src/app/dashboard/actions.ts
git commit -m "feat(actions): sprint CRUD + task assignment"
```

### Step 3d: UI (1 commit)

`src/components/sprint/SprintQuickAdd.tsx` (new client component) — see [`docs/EXTENDING.md` Recipe 1 Step 4](../../docs/EXTENDING.md) for the canonical template.

`src/components/sprint/SprintList.tsx` (server component) — renders list + nested SprintRow client components.

Wire into `src/app/dashboard/projects/[id]/page.tsx`:
```typescript
import { SprintList } from "@/components/sprint/SprintList";
// ...

<section className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-base font-semibold">Sprints</h2>
    <SprintQuickAdd projectId={project.id} />
  </div>
  <SprintList sprints={project.sprints} canEdit={canEdit} />
</section>
```

Update the project Prisma query to include sprints:
```typescript
sprints: { orderBy: { startDate: "desc" } }
```

```bash
git add src/components/sprint/ src/app/dashboard/projects/
git commit -m "feat(ui): sprint quick-add + list on project detail"
```

## Phase 4: Test (15 min, 1 commit)

Manual:
- Sign in as admin → create project → add 3 tasks
- Create sprint "Week 1" with valid dates → see toast → see sprint in list
- Try invalid dates (end < start) → see error toast, no row created
- Sign out → sign in as member of project → create sprint succeeds
- Sign in as non-member MEMBER → try createSprint via UI → blocked

Once Vitest harness lands:

`src/app/dashboard/__tests__/sprints.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
// test createSprint with valid input
// test createSprint with invalid date range
// test createSprint as non-member returns Forbidden
```

```bash
git add .
git commit -m "test(sprints): manual smoke + RBAC matrix (vitest pending)"
```

## Phase 5: Review (15 min, no commit until fixes land)

```bash
codex review
```

Apply findings as additional commits (each fix one commit, atomic).

## Phase 6: Ship

```bash
git push -u origin feat/sprints
gh pr create --title "feat: sprints" --body "$(cat .planning/sprints/PLAN.md)"
# After CI green + review approved:
gh pr merge --squash
```

## Phase 7: Learn (5 min, 1 commit)

Write `.planning/sprints/RETRO.md`:
```markdown
# Retro: Sprints

## What went well
- Validation refine() caught date-range invalid input cleanly
- Reusing Task assignment pattern made UI fast

## What went badly
- Forgot to add sprintId index on Task initially — caught in code review

## What I'd do differently
- Write the indexes in Phase 2 plan, not as an afterthought

## What to bake into the rules
- Add to AGENTS.md: every foreign key on a Prisma model needs an @@index
```

```bash
git add .planning/sprints/RETRO.md
git commit -m "docs(sprints): retro"
```

Open a PR updating `AGENTS.md` with the new rule. Methodology improves.

---

## Total commits: ~9 (atomic)
## Total time: ~2 hours
## Total LOC: ~400-600

This is the canonical recipe. Copy-paste this file when adding a new entity. Replace "Sprint" with your entity. Replace examples with yours.
