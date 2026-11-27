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
import {
  PriorityBadge,
  ProjectStatusBadge,
} from "@/components/project/StatusBadge";
import { UpdateList } from "@/components/project/UpdateList";
import { additionalDetailsSchema } from "@/lib/additional-details";
import { deliveryRange, chronologicalStages } from "@/lib/timeline";
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
import { formatDate, formatWallTime, timeAgo, wallNow } from "@/lib/utils";
import { MeetingForm } from "@/components/meetings/MeetingForm";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";
import {
  addStageComment,
  deleteStageComment,
  deleteMeeting,
} from "@/app/dashboard/actions";

/** Present three project sections while preserving legacy tab and enhancement links. */
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
  // Keep bookmarked sections and timeline change links working after consolidation.
  const tab =
    requestedTab === "history"
      ? "history"
      : ["work", "reports", "enhancements", "activity"].includes(
            requestedTab ?? "",
          )
        ? "work"
        : "overview";
  const session = await auth();
  if (!session?.user) return null;

  const [project, allTags, members] = await Promise.all([
    db.project.findUnique({
      where: { id, AND: [projectAccessWhere(session.user)] },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        coOwner: { select: { id: true, name: true } },
        brand: { select: { name: true } },
        stageComments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        meetings: {
          where: { startsAt: { gte: new Date(Date.now() - 14 * 86400000) } },
          include: { attendees: { select: { id: true, name: true } } },
          orderBy: { startsAt: "asc" },
          take: 20,
        },
        helpRequests: {
          where: { status: { in: ["OPEN", "ASSIGNED"] } },
          include: { assignee: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
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
  const chronological = chronologicalStages(stages);
  const meetingPeople = [
    ...new Map(
      [project.owner, ...(project.coOwner ? [project.coOwner] : []), ...project.members, ...members].map(
        (p) => [p.id, { id: p.id, name: p.name }],
      ),
    ).values(),
  ];
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-5">
      <header className="space-y-4">
        <Link className="text-link text-sm" href="/dashboard/projects">
          ← Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 basis-full flex-1 space-y-2 sm:basis-0">
            <ProjectStatusBadge status={project.status} />
            <h1 className="page-title min-w-0 break-words">{project.title}</h1>
            {project.summary && (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {project.summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button asChild size="sm">
                <Link href={`/dashboard/projects/${id}/edit`}>
                  Edit project
                </Link>
              </Button>
            )}
            {canDelete && (
              <details className="relative">
                <summary className="cursor-pointer rounded-lg border bg-card px-3 py-2 text-sm">
                  More
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border bg-card p-2 shadow-lg">
                  <ActionForm
                    action={archiveProject.bind(null, id)}
                    label="Archive project"
                    successMessage="Project archived."
                    className="space-y-2"
                  />
                </div>
              </details>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Avatar name={project.owner.name} className="h-6 w-6 text-[10px]" />
            <span>
              Owner ·{" "}
              <strong className="text-foreground">{project.owner.name}</strong>
            </span>
          </span>
          {project.coOwner && <span>Sub-owner · {project.coOwner.name}</span>}
          {project.brand && <span className="pill">{project.brand.name}</span>}
          <span className="rounded-lg bg-brand-tint px-3 py-1.5 text-brand-navy">
            Target · {formatDate(project.targetDate)}
          </span>
        </div>
      </header>
      <nav className="flex gap-1 border-b" aria-label="Project sections">
        {[
          ["overview", "Overview"],
          ["work", "Work"],
          ["history", "History"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`?tab=${value}`}
            aria-current={tab === value ? "page" : undefined}
            className={`rounded-t-lg border-b-2 px-5 py-3 text-sm ${tab === value ? "border-brand-orange bg-brand-tint font-semibold text-brand-navy" : "border-transparent text-muted-foreground hover:bg-secondary"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <section className="surface min-w-0 max-w-full border-t-4 border-t-brand-orange">
            <ProjectJourney
              key={`${id}:${project.enhancements.length}`}
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
              controls={
                canEdit ? (
                  <div className="space-y-3 border-t pt-4">
                    <details className="disclosure">
                      <summary>Add a change</summary>
                      <div className="disclosure-body">
                        <ActionForm
                          action={addEnhancement.bind(null, id)}
                          label="Add change"
                          successMessage="Change added to the project timeline."
                        >
                          <EnhancementFields />
                        </ActionForm>
                      </div>
                    </details>
                    <Link
                      className="text-link inline-block text-xs"
                      href={`/dashboard/projects/${id}/edit#timeline-dates`}
                    >
                      Edit timeline dates
                    </Link>
                  </div>
                ) : undefined
              }
            />
          </section>
          <section id="stage-comments" className="surface space-y-4 scroll-mt-24">
            <div>
              <h2 className="section-title">Manager comments by stage</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Feedback from managers on each delivery stage. Everyone on the project can read it.
              </p>
            </div>
            {chronological.map((stage) => {
              const notes = project.stageComments.filter((c) => c.stageId === stage.id);
              if (!notes.length) return null;
              return (
                <div key={stage.id} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {stage.kind} · {stage.title}
                  </p>
                  {notes.map((c) => (
                    <div key={c.id} className="rounded-lg border-l-4 border-l-brand-blue bg-secondary/40 p-3">
                      <p className="whitespace-pre-wrap text-sm">{c.content}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {c.author.name} · {timeAgo(c.createdAt)}
                        </span>
                        {(c.authorId === session.user.id || session.user.role === "ADMIN") && (
                          <ActionForm action={deleteStageComment.bind(null, c.id, id)} label="Remove" className="" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {!project.stageComments.length && (
              <p className="text-sm text-muted-foreground">No manager comments yet.</p>
            )}
            {isManagerOrAbove(session.user.role) && (
              <details className="disclosure" open={!project.stageComments.length}>
                <summary>Add a manager comment</summary>
                <div className="disclosure-body">
                  <ActionForm action={addStageComment.bind(null, id)} label="Add comment" successMessage="Comment added." className="space-y-3">
                    <label className="field">
                      Stage
                      <select name="stageId" defaultValue={project.id}>
                        {chronological.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.kind} · {stage.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Comment
                      <textarea name="content" required maxLength={2000} rows={3} />
                    </label>
                  </ActionForm>
                </div>
              </details>
            )}
          </section>
          <section id="meetings" className="surface space-y-4 scroll-mt-24">
            <h2 className="section-title">Meetings</h2>
            <ul className="space-y-2">
              {project.meetings.map((m) => (
                <li key={m.id} className={`rounded-lg border p-3 text-sm ${m.startsAt < wallNow() ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {m.title}
                        {m.kind === "ADHOC" && <span className="pill ml-2">Ad-hoc</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWallTime(m.startsAt)} · {m.attendees.map((a) => a.name).join(", ")}
                      </p>
                      {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs">{m.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {m.link && (
                        <a className="text-link text-xs" href={m.link} target="_blank" rel="noreferrer">
                          Join
                        </a>
                      )}
                      {(m.organizerId === session.user.id || isManagerOrAbove(session.user.role)) && (
                        <ActionForm action={deleteMeeting.bind(null, m.id)} label="Remove" className="" />
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {!project.meetings.length && (
                <li className="text-sm text-muted-foreground">No meetings in the last two weeks or coming up.</li>
              )}
            </ul>
            {canEdit && (
              <div className="grid gap-3 md:grid-cols-2">
                {project.coOwner && (
                  <details className="disclosure">
                    <summary>Ad-hoc meeting with {project.coOwner.name}</summary>
                    <div className="disclosure-body">
                      <MeetingForm
                        people={meetingPeople}
                        projectId={id}
                        kind="ADHOC"
                        title={`Quick sync: ${project.title}`.slice(0, 160)}
                        attendeeIds={[project.ownerId, project.coOwner.id]}
                        label="Save ad-hoc meeting"
                      />
                    </div>
                  </details>
                )}
                <details className="disclosure">
                  <summary>Schedule a meeting</summary>
                  <div className="disclosure-body">
                    <MeetingForm
                      people={meetingPeople}
                      projectId={id}
                      title={`${project.title} sync`.slice(0, 160)}
                      attendeeIds={[project.ownerId, ...(project.coOwnerId ? [project.coOwnerId] : []), ...memberIds]}
                    />
                  </div>
                </details>
              </div>
            )}
          </section>
          <section id="project-team" className="surface space-y-3 scroll-mt-24">
            <h2 className="section-title">Project team</h2>
            <MembersPicker
              projectId={id}
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
          <details className="disclosure" open={requestedTab === "details"}>
            <summary>Project details</summary>
            <div className="disclosure-body">
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [
                    "Type",
                    project.projectType.toLowerCase().replaceAll("_", " "),
                  ],
                  ["Starts", formatDate(project.startDate)],
                  ["Completed", formatDate(project.actualEndDate)],
                  [
                    "Fiscal deadline",
                    project.targetDate
                      ? fiscalLabel(project.targetDate, fiscalConfigs)
                      : "Not scheduled",
                  ],
                  [
                    "Expected time saved",
                    project.savedHours === null
                      ? "Not estimated"
                      : `${project.savedHours} hours / week`,
                  ],
                  ["Brand", project.brand?.name || "—"],
                  ["Team", project.department || "—"],
                  ["Sub-team", project.subTeam || "—"],
                  ["Version", String(project.version)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-muted-foreground">Priority</dt>
                  <dd className="mt-1">
                    <PriorityBadge priority={project.priority} />
                  </dd>
                </div>
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
              {source && (
                <p className="text-sm">
                  Continues / enhances{" "}
                  <Link
                    className="text-link"
                    href={`/dashboard/projects/${source.id}`}
                  >
                    {source.title}
                  </Link>
                </p>
              )}
              {project.acceptanceCriteria && (
                <div>
                  <h3 className="section-title">Success criteria</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {project.acceptanceCriteria}
                  </p>
                </div>
              )}
              <div>
                <h3 className="mb-3 section-title">Description</h3>
                <BlockReader
                  content={(project.description as Block[] | null) ?? null}
                />
              </div>
              <div>
                <h3 className="mb-3 section-title">Tags</h3>
                <TagPicker
                  projectId={id}
                  allTags={allTags}
                  selectedIds={project.tags.map((t) => t.id)}
                  canEdit={canEdit}
                />
              </div>
              {project.requests.map((request) => (
                <RequestContext key={request.id} request={request} />
              ))}
              <p className="text-xs text-muted-foreground">
                Updated {timeAgo(project.updatedAt)}
              </p>
            </div>
          </details>
        </>
      )}
      {tab === "work" && (
        <>
          <section className="surface space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">
                Reports{" "}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {project.tasks.filter((t) => t.status === "DONE").length} /{" "}
                  {project.tasks.length} complete
                </span>
              </h2>
              {canEdit && <TaskQuickAdd projectId={id} assignees={members} />}
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
          <section className="surface space-y-3">
            <h2 className="section-title">Help from the BI team</h2>
            {project.helpRequests.map((r) => (
              <p key={r.id} className="text-sm">
                {r.status === "OPEN" ? (
                  <span className="pill mr-2">Waiting in help pool</span>
                ) : (
                  <span className="pill mr-2">{r.assignee?.name ?? "Someone"} is helping</span>
                )}
                {r.details}
              </p>
            ))}
            {canEdit ? (
              <details className="disclosure">
                <summary>Ask for help on this project</summary>
                <div className="disclosure-body">
                  <HelpRequestForm projectId={id} />
                </div>
              </details>
            ) : (
              !project.helpRequests.length && (
                <p className="text-sm text-muted-foreground">No help requests.</p>
              )
            )}
            <Link className="text-link text-xs" href="/dashboard/help">
              Open the help pool →
            </Link>
          </section>
          <details
            className="disclosure"
            open={requestedTab === "enhancements"}
          >
            <summary>
              Changes & enhancements · {project.enhancements.length}
            </summary>
            <div className="disclosure-body">
              <EnhancementList
                projectId={id}
                items={project.enhancements}
                onAdd={addEnhancement}
                onUpdate={updateEnhancement}
                onDelete={deleteEnhancement}
                viewerId={session.user.id}
                canManage={canEdit}
              />
            </div>
          </details>
          <details className="disclosure">
            <summary>
              Milestones ·{" "}
              {project.milestones.filter((m) => m.completed).length} /{" "}
              {project.milestones.length} complete
            </summary>
            <div className="disclosure-body">
              <MilestoneList
                projectId={id}
                items={project.milestones}
                onAdd={addMilestone}
                onToggle={toggleMilestone}
                onDelete={deleteMilestone}
                canManage={canEdit}
              />
            </div>
          </details>
          <details className="disclosure" open={requestedTab === "activity"}>
            <summary>Updates & discussion</summary>
            <div className="disclosure-body">
              <section className="space-y-3">
                <h2 className="section-title">Status updates</h2>
                <UpdateList
                  updates={project.updates.map((u) => ({
                    id: u.id,
                    content: u.content as Block[] | null,
                    createdAt: u.createdAt,
                    author: u.author,
                  }))}
                  onAdd={addProjectUpdate.bind(null, id)}
                />
              </section>
              <section className="space-y-3">
                <h2 className="section-title">Comments</h2>
                <CommentThread
                  projectId={id}
                  items={project.comments}
                  viewerId={session.user.id}
                  canManage={canEdit}
                  onAdd={addComment}
                  onDelete={deleteComment}
                />
              </section>
            </div>
          </details>
        </>
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
