import { assignablePeopleWhere } from "@/lib/project-people";
import { requestDetailsSelect } from "@/lib/request-details";
import { RequestContext } from "@/components/requests/RequestContext";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Block } from "@blocknote/core";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PriorityBadge,
  ProjectStatusBadge,
} from "@/components/project/StatusBadge";
import { UpdateList } from "@/components/project/UpdateList";
import { additionalDetailsSchema } from "@/lib/additional-details";
import { deliveryRange } from "@/lib/timeline";
import { ActionForm } from "@/components/ui/action-form";
import {
  EnhancementList,
  EnhancementFields,
} from "@/components/project/EnhancementList";
import { MilestoneList } from "@/components/project/MilestoneList";
import { CommentThread } from "@/components/project/CommentThread";
import { TagPicker } from "@/components/project/TagPicker";
import { TaskQuickAdd } from "@/components/task/TaskQuickAdd";
import { TaskTable } from "@/components/task/TaskTable";
import { ProjectJourney } from "@/components/project/ProjectJourney";
import { ProjectHistory } from "@/components/project/ProjectHistory";
import { fiscalLabel } from "@/lib/fiscal";
import { MembersPicker } from "@/components/project/MembersPicker";
import { BlockReader } from "@/components/editor/BlockReader";
import {
  addComment,
  addEnhancement,
  addMilestone,
  addProjectUpdate,
  deleteComment,
  deleteEnhancement,
  deleteMilestone,
  archiveProject,
  toggleMilestone,
  updateEnhancement,
} from "@/app/dashboard/actions";
import {
  canEditProject,
  canDeleteProject,
  canViewProject,
  projectAccessWhere,
  isManagerOrAbove,
  taskPermissions,
} from "@/lib/rbac";
import { formatDate, timeAgo } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; hpage?: string }>;
}) {
  const { id } = await params;
  const { tab: requestedTab, hpage } = await searchParams;
  const pageNumber = Number(hpage);
  const historyPage =
    Number.isSafeInteger(pageNumber) && pageNumber > 0
      ? Math.min(10000, pageNumber)
      : 1;
  const tab = [
    "overview",
    "details",
    "reports",
    "enhancements",
    "activity",
    "history",
  ].includes(requestedTab ?? "")
    ? requestedTab
    : "overview";
  const session = await auth();
  if (!session?.user) return null;

  const [project, allTags, members] = await Promise.all([
    db.project.findUnique({
      where: { id, AND: [projectAccessWhere(session.user)] },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        coOwner: { select: { id: true, name: true } },
        derivedProjects: {
          where: projectAccessWhere(session.user),
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            targetDate: true,
            actualEndDate: true,
            createdAt: true,
          },
        },
        members: { select: { id: true, name: true, email: true } },
        tags: true,
        tasks: {
          include: {
            assignee: { select: { id: true, name: true } },
            reporter: { select: { id: true, name: true } },
          },
          orderBy: [
            { status: "asc" },
            { priority: "desc" },
            { dueDate: "asc" },
            { orderIndex: "asc" },
          ],
        },
        updates: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        requests: {
          select: requestDetailsSelect,
          orderBy: { createdAt: "desc" },
        },
        enhancements: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        milestones: {
          orderBy: [
            { completed: "asc" },
            { dueDate: "asc" },
            { orderIndex: "asc" },
          ],
        },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({
      where: assignablePeopleWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!project) notFound();

  const memberIds = project.members.map((m) => m.id);
  if (
    !canViewProject({
      viewerRole: session.user.role,
      viewerId: session.user.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds,
    })
  )
    notFound();
  const canEdit = canEditProject({
    viewerRole: session.user.role,
    viewerId: session.user.id,
    ownerId: project.ownerId,
    coOwnerId: project.coOwnerId,
    memberIds,
  });
  const canDelete = canDeleteProject({
    viewerRole: session.user.role,
    viewerId: session.user.id,
    ownerId: project.ownerId,
  });

  const [events, revisions, eventCount, revisionCount, fiscalConfigs, source] =
    await Promise.all([
      tab === "history"
        ? db.auditLog.findMany({
            where: { projectId: id },
            orderBy: { createdAt: "desc" },
            take: 30,
            skip: (historyPage - 1) * 30,
          })
        : [],
      tab === "history"
        ? db.projectRevision.findMany({
            where: { projectId: id },
            orderBy: { version: "desc" },
            take: 30,
            skip: (historyPage - 1) * 30,
          })
        : [],
      tab === "history" ? db.auditLog.count({ where: { projectId: id } }) : 0,
      tab === "history"
        ? db.projectRevision.count({ where: { projectId: id } })
        : 0,
      db.fiscalYearConfig.findMany(),
      project.sourceProjectId
        ? db.project.findUnique({
            where: {
              id: project.sourceProjectId,
              AND: [projectAccessWhere(session.user)],
            },
            select: { id: true, title: true },
          })
        : null,
    ]);
  const names = Object.fromEntries<string>([
    ...members.map((m) => [m.id, m.name] as const),
    ...allTags.map((t) => [t.id, t.name] as const),
    ...project.derivedProjects.map((p) => [p.id, p.title] as const),
    ...(source ? [[source.id, source.title] as const] : []),
  ]);
  const additionalDetails = additionalDetailsSchema.parse(
    project.additionalDetails,
  );
  const stages = [
    {
      id: project.id,
      title: "Original delivery",
      status: project.status,
      kind: "Original delivery" as const,
      ...deliveryRange({
        startDate: project.startDate,
        targetDate: project.targetDate,
        completedAt: project.actualEndDate,
        createdAt: project.createdAt,
      }),
    },
    ...project.enhancements.map((enhancement) => ({
      id: enhancement.id,
      title: enhancement.releaseLabel
        ? `${enhancement.releaseLabel} · ${enhancement.title}`
        : enhancement.title,
      status: enhancement.status,
      kind: "Enhancement" as const,
      href: `?tab=enhancements#enhancement-${enhancement.id}`,
      ...deliveryRange({
        startDate: enhancement.startDate,
        targetDate: enhancement.targetDate,
        completedAt: enhancement.completedAt,
        createdAt: enhancement.createdAt,
      }),
    })),
    ...project.derivedProjects.map((related) => ({
      id: related.id,
      title: related.title,
      status: related.status,
      kind: "Linked project" as const,
      href: `/dashboard/projects/${related.id}`,
      ...deliveryRange({
        startDate: related.startDate,
        targetDate: related.targetDate,
        completedAt: related.actualEndDate,
        createdAt: related.createdAt,
      }),
    })),
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-4">
        <p className="eyebrow">
          <Link href="/dashboard/projects">Projects</Link> /{" "}
          {project.projectType.replaceAll("_", " ").toLowerCase()} · Version{" "}
          {project.version}
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {project.title}
              </h1>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            {project.summary && (
              <p className="text-sm text-slate-500">{project.summary}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {(project.ownerId === session.user.id ||
              isManagerOrAbove(session.user.role)) && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/projects/${project.id}?tab=overview#project-team`}
                >
                  + Add member
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/projects/${project.id}/edit`}>
                  Edit
                </Link>
              </Button>
            )}
            {canDelete && (
              <form action={archiveProject.bind(null, project.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  Archive
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Avatar name={project.owner.name} className="h-6 w-6 text-[10px]" />
            Owner:{" "}
            <strong className="text-slate-700">{project.owner.name}</strong>
          </span>
          <span>
            Sub-owner:{" "}
            <strong>{project.coOwner?.name ?? "Not assigned"}</strong>
          </span>
          <span>Starts: {formatDate(project.startDate)}</span>
          <span>Target: {formatDate(project.targetDate)}</span>
          <span>Updated {timeAgo(project.updatedAt)}</span>
        </div>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto border-b pb-1"
        aria-label="Project sections"
      >
        {[
          "overview",
          "details",
          "reports",
          "enhancements",
          "activity",
          "history",
        ].map((t) => (
          <Link
            key={t}
            href={`?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={`shrink-0 rounded-t-lg px-4 py-3 text-sm capitalize ${tab === t ? "border-b-2 border-brand-orange bg-card font-semibold" : "text-muted-foreground hover:bg-secondary"}`}
          >
            {t}
          </Link>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <section className="surface">
            <ProjectJourney
              key={project.enhancements.length}
              controls={
                canEdit ? (
                  <>
                    <p className="mt-4 text-xs text-muted-foreground">
                      <Link
                        className="text-link"
                        href={`/dashboard/projects/${id}/edit#timeline-dates`}
                      >
                        Set or edit project dates
                      </Link>{" "}
                      · Add a change with its own start and deadline, during or
                      after delivery.
                    </p>
                    <details className="mt-5 rounded-xl border bg-secondary/20 p-4">
                      <summary className="cursor-pointer text-sm font-semibold">
                        + Add change to timeline
                      </summary>
                      <div className="mt-4">
                        <ActionForm
                          action={addEnhancement.bind(null, project.id)}
                          label="Add change"
                          successMessage="Change added to the project timeline."
                        >
                          <EnhancementFields />
                        </ActionForm>
                      </div>
                    </details>
                  </>
                ) : undefined
              }
              stages={stages}
              fiscalConfigs={fiscalConfigs}
              milestones={project.milestones
                .filter((m) => m.dueDate)
                .map((m) => ({
                  id: m.id,
                  title: m.title,
                  date: m.dueDate!.toISOString(),
                  completed: m.completed,
                }))}
            />
          </section>
          {project.requests.map((request) => (
            <RequestContext key={request.id} request={request} />
          ))}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Delivery deadline", formatDate(project.targetDate)],
              [
                "Fiscal deadline",
                project.targetDate
                  ? fiscalLabel(project.targetDate, fiscalConfigs)
                  : "Not scheduled",
              ],
              [
                "Estimated effort",
                project.estimatedHours === null
                  ? "Not estimated"
                  : `${project.estimatedHours} hours`,
              ],
              [
                "Expected time saved",
                project.savedHours === null
                  ? "Not estimated"
                  : `${project.savedHours} hours / week`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="surface">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {source && (
            <p className="text-sm text-muted-foreground">
              Continues / enhances{" "}
              <Link
                className="text-link"
                href={`/dashboard/projects/${source.id}`}
              >
                {source.title}
              </Link>
            </p>
          )}

          <section id="project-team" className="surface space-y-4 scroll-mt-24">
            <div>
              <h2 className="section-title">Project team</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Add another person using + Add member.
              </p>
            </div>
            <MembersPicker
              projectId={project.id}
              ownerName={project.owner.name}
              allUsers={members.filter(
                (person) => person.id !== project.ownerId,
              )}
              selectedIds={memberIds}
              existingMembers={project.members.filter(
                (person) => person.id !== project.ownerId,
              )}
              canEdit={
                project.ownerId === session.user.id ||
                isManagerOrAbove(session.user.role)
              }
            />
          </section>
          {!!additionalDetails.length && (
            <section className="surface">
              <h2 className="section-title">Additional details</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {additionalDetails.map((field) => (
                  <div key={field.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                      {field.value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="surface space-y-4">
            <h2 className="section-title">Delivery milestones</h2>
            <MilestoneList
              projectId={project.id}
              items={project.milestones}
              onAdd={addMilestone}
              onToggle={toggleMilestone}
              onDelete={deleteMilestone}
              canManage={canEdit}
            />
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface">
              <h2 className="section-title">Success criteria</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {project.acceptanceCriteria ||
                  "Define what success looks like in project details."}
              </p>
            </div>
            <div className="surface">
              <h2 className="section-title">At a glance</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {project.tasks.filter((t) => t.status === "DONE").length} /{" "}
                {project.tasks.length} reports delivered ·{" "}
                {project.enhancements.filter((e) => e.status === "DONE").length}{" "}
                / {project.enhancements.length} enhancements completed
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Original delivery completed: {formatDate(project.actualEndDate)}
              </p>
              {project.department && (
                <p className="mt-2 text-sm">Team: {project.department}</p>
              )}
              {project.subTeam && (
                <p className="mt-2 text-sm">Sub-team: {project.subTeam}</p>
              )}
            </div>
          </div>
        </>
      )}
      {tab === "details" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <MembersPicker
                projectId={project.id}
                ownerName={project.owner.name}
                allUsers={members.filter((m) => m.id !== project.ownerId)}
                selectedIds={memberIds}
                existingMembers={project.members.filter(
                  (person) => person.id !== project.ownerId,
                )}
                canEdit={
                  project.ownerId === session.user.id ||
                  isManagerOrAbove(session.user.role)
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <TagPicker
                projectId={project.id}
                allTags={allTags}
                selectedIds={project.tags.map((t) => t.id)}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <BlockReader
                content={(project.description as Block[] | null) ?? null}
              />
            </CardContent>
          </Card>
        </>
      )}
      {tab === "reports" && (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Reports{" "}
                <span className="text-xs font-normal text-slate-400">
                  ({project.tasks.length})
                </span>
              </h2>
              {canEdit && (
                <TaskQuickAdd projectId={project.id} assignees={members} />
              )}
            </div>
            <TaskTable
              rows={project.tasks.map((task) => ({
                ...task,
                ...taskPermissions(session.user, { ...task, project }),
              }))}
              assignees={members}
              viewerId={session.user.id}
              canManage={canEdit}
            />
          </section>
        </>
      )}
      {tab === "activity" && (
        <>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Status updates</h2>
            <UpdateList
              updates={project.updates.map((u) => ({
                id: u.id,
                content: u.content as Block[] | null,
                createdAt: u.createdAt,
                author: u.author,
              }))}
              onAdd={addProjectUpdate.bind(null, project.id)}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Comments</h2>
            <CommentThread
              projectId={project.id}
              items={project.comments}
              viewerId={session.user.id}
              canManage={canEdit}
              onAdd={addComment}
              onDelete={deleteComment}
            />
          </section>
        </>
      )}
      {tab === "enhancements" && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Enhancements</h2>
          <EnhancementList
            projectId={project.id}
            items={project.enhancements}
            onAdd={addEnhancement}
            onUpdate={updateEnhancement}
            onDelete={deleteEnhancement}
            viewerId={session.user.id}
            canManage={canEdit}
          />
        </section>
      )}
      {tab === "history" && (
        <ProjectHistory
          projectId={id}
          version={project.version}
          revisions={revisions}
          page={historyPage}
          pages={Math.max(
            1,
            Math.ceil(Math.max(eventCount, revisionCount) / 30),
          )}
          events={events}
          names={names}
          canRestore={
            project.ownerId === session.user.id ||
            isManagerOrAbove(session.user.role)
          }
        />
      )}
    </div>
  );
}
