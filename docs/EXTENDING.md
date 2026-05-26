# Extending OfficeHub

> Concrete recipes for adding features. Paired with [`GSD-PLAYBOOK.md`](GSD-PLAYBOOK.md) — the playbook is the *process*, this doc is the *patterns*.

---

## Recipe 1: Add a new entity end-to-end

We'll walk through adding `Sprint` (groups tasks into time-boxed iterations).

### Step 1: Schema (`prisma/schema.prisma`)

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

Add the inverse on `Task`:
```prisma
sprintId String?
sprint   Sprint? @relation("SprintTasks", fields: [sprintId], references: [id], onDelete: SetNull)
```

Apply:
```bash
npx prisma db push
npx prisma generate
```

### Step 2: Validation (`src/lib/validation.ts`)

```typescript
export const sprintCreateSchema = z.object({
  name: z.string().min(1).max(80),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  goal: z.string().max(500).optional().nullable(),
}).refine((d) => new Date(d.endDate) > new Date(d.startDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});
export const sprintUpdateSchema = sprintCreateSchema.partial();
```

### Step 3: Server actions (`src/app/dashboard/actions.ts`)

```typescript
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
```

Mirror this pattern for `updateSprint`, `deleteSprint`, `assignTaskToSprint`.

### Step 4: Client component (`src/components/sprint/SprintQuickAdd.tsx`)

```typescript
"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSprint } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";

export function SprintQuickAdd({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function onSubmit(fd: FormData) {
    start(async () => {
      try {
        await createSprint(projectId, fd);
        toast("Sprint created", "success");
        setOpen(false);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not create sprint", "error");
      }
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)} size="sm">+ New sprint</Button>;
  }
  return (
    <form action={onSubmit} className="grid gap-2 rounded-md border border-black/15 p-3 md:grid-cols-[1fr_140px_140px_auto]">
      <Input name="name" autoFocus required placeholder="Sprint name" />
      <Input name="startDate" type="date" required />
      <Input name="endDate" type="date" required />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
```

### Step 5: Page integration (`src/app/dashboard/projects/[id]/page.tsx`)

Add a Sprints section above Tasks:
```typescript
<section className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-base font-semibold">Sprints</h2>
    <SprintQuickAdd projectId={project.id} />
  </div>
  <SprintList sprints={project.sprints} />
</section>
```

Update the project query to include sprints:
```typescript
sprints: { orderBy: { startDate: "desc" } }
```

### Step 6: Sidebar link (optional)

If sprints get a dedicated page (`/dashboard/sprints`), add to `src/components/layout/Sidebar.tsx` and `src/components/layout/MobileNav.tsx`. For project-scoped entities like Sprint, skip — they live on the project page.

### Step 7: Verify

```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters    # MUST be clean
npm run build                                              # MUST succeed
# Manual: create sprint, assign task, view it, delete it. Confirm RBAC blocks non-members.
```

Done.

---

## Recipe 2: Add a REST API endpoint

Pattern is in `src/app/api/projects/[id]/route.ts`. Steps:

1. Create `src/app/api/<resource>/route.ts` (for collections) or `src/app/api/<resource>/[id]/route.ts` (for items)
2. Use `requireApiAuth()` from `src/lib/api.ts` to gate
3. Validate with Zod schema from `src/lib/validation.ts`
4. Apply RBAC (same helpers as server actions)
5. Return `jsonOk(data, status)` on success, `jsonError(code, message, status)` on failure
6. Update `docs/API.md` with the new endpoint shape

Don't reinvent auth — `requireApiAuth` is the only path.

---

## Recipe 3: Add a feature flag

Edit `config/features.ts`:

```typescript
export const features = {
  // existing flags...
  sprints: {
    enabled: env("FEATURE_SPRINTS", "true") === "true",
    label: "Sprints",
    description: "Group tasks into time-boxed iterations",
  },
} as const;
```

Then in any page or component:

```typescript
import { features } from "@/config/features";

if (!features.sprints.enabled) return null;
```

Document the flag in `.env.example`. Set sane default (usually `true`).

---

## Recipe 4: Add a wiki page template

Edit `src/lib/pageTemplates.ts`. Add a new `PageTemplate` to the `PAGE_TEMPLATES` array. The shape:

```typescript
{
  key: "incident",
  label: "Incident report",
  emoji: "🚨",
  description: "Post-incident retrospective template",
  title: "Incident — ",
  content: [
    h(1, "Incident report"),
    h(3, "Timeline"),
    p(""),
    h(3, "Root cause"),
    p(""),
    // ... more blocks
  ],
}
```

Done — the template appears in the "+ New page" dropdown immediately.

---

## Recipe 5: Add a global keyboard shortcut

Edit `src/components/layout/CommandPalette.tsx` or extract to a `useKeybinding` hook. Pattern:

```typescript
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "j") {
      e.preventDefault();
      // do thing
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

Document in `AGENTS.md` and update the README keyboard-shortcuts section if added.

---

## Recipe 6: Add a new RBAC permission

1. Edit `src/lib/rbac.ts` — add a new helper (e.g. `canManageSprints({...})`)
2. Use it in every server action that performs the gated operation
3. Use it in the API route guard
4. Use it conditionally in UI (`if (!canManageSprints({...})) return null`)
5. Add a row to the RBAC matrix in `AGENTS.md`

Never check raw role strings in UI components — always go through `rbac.ts`.

---

## Recipe 7: Add an integration (Slack webhook, etc.)

1. Add a feature flag in `config/features.ts` (default off)
2. Store the webhook URL in `.env.example` (default empty)
3. Create `src/lib/integrations/<name>.ts` with a single send function
4. Call it from the relevant server action (e.g. send Slack message after `addProjectUpdate`)
5. Wrap in try/catch — never fail the user action because the integration failed
6. Document setup in `docs/INTEGRATIONS.md` (create if absent)

---

## Recipe 8: Add a chart / data viz

OfficeHub deliberately avoids heavy chart libraries. For simple viz:
1. Server component fetches aggregated data with Prisma
2. Render as inline SVG (good for sparklines, bars, dot-plots)
3. Or use Tailwind grid + dynamic widths for "CSS bar chart"

If you genuinely need a chart library: `recharts` is the project's nominal choice (lightweight, SSR-safe). Add it via a dynamic import to avoid bloating the shared bundle.

---

## When to NOT extend OfficeHub directly

If you're building something OfficeHub-specific but with a UX that doesn't fit the existing patterns (e.g. a CRM, a build pipeline, a chat UI), consider:
- Forking OfficeHub
- Or building a separate sibling project that reads OfficeHub's REST API

OfficeHub's product surface is intentionally small. Adding "everything" makes it Notion-bloat. Extend within scope or fork.

---

## Anti-patterns (don't do these)

- **Importing server-only code into client components** — `db`, `auth` are server-only.
- **Inline arrow closures around server actions when passing as props** — use `.bind(null, id)`.
- **Server components with `onChange` on inline `<select>`** — use `<AutoSubmitSelect>`.
- **`useEffect` for data fetching in a Server Component** — fetch with `await db.x` directly.
- **Adding a `dark:` Tailwind variant** — dead code, ignored.
- **Catching exceptions silently** in `useTransition(async)` — always toast on error.
- **Schema changes without `db push && generate`** — TypeScript will lie to you.
- **Hardcoding role checks** (`if (user.role === "ADMIN")`) — use `isAdmin(user.role)`.

---

## Patterns in the codebase to copy from

| Need | Look at |
|---|---|
| Entity with status workflow + inline status change | Tasks (`src/components/task/*`) |
| Many-to-many relation | Tags + Project Members |
| Tree structure (parent-child) | Page tree (`src/components/pages/PageTree.tsx`) |
| Token-gated public page | Invite acceptance (`src/app/invite/[token]/page.tsx`) |
| Tabbed UI for two flows | Team page (`src/components/team/AddTeammateTabs.tsx`) |
| Server action with optimistic update + rollback | FavoriteButton (`src/components/project/FavoriteButton.tsx`) |
| Auto-saved editor | Page editor (`src/components/pages/PageEditor.tsx`) |
| Calendar grid | `src/app/dashboard/calendar/page.tsx` |
| Quick-add inline form | TaskQuickAdd (`src/components/task/TaskQuickAdd.tsx`) |

When in doubt, copy the closest pattern and adapt.
