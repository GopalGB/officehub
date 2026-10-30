# Project workspace guide

OfficeHub is organized around **Projects → Reports and Enhancements → My week**. Managers use **Team overview** and **Request pool**. The wiki remains available for free-form documentation.

## Projects and ownership

Each project has an owner and optional sub-owner. Owners, sub-owners, explicit collaborators, managers, and administrators can edit the content. Only the owner or management can transfer ownership or restore saved project versions; collaborators cannot grant themselves these permissions. Managers and administrators can view every project and report. Assign a CEO a MANAGER or ADMIN account as appropriate; a job title does not automatically grant access.

A project records its type (new project, enhancement, or support/maintenance), optional source project, department, summary, rich description, success criteria, status, priority, start date, deadline, estimated effort, and expected hours saved per week. The source selector rejects self-links and circular lineage. Manager assignments create projects owned by the selected active person.

Use **Additional details → Add field** on the create/edit form for extra spreadsheet columns or project-specific information. Labels and values stay in their entered order, including leading zeros, multiline text, and file references. Up to 50 fields are supported, with 100 characters per label and 5,000 per value. Duplicate field names are rejected. Additional details and sub-team are saved in project versions, can be restored, and are preserved when an unrelated API update omits them.

### Import a project register

Managers and administrators can open **Projects → Import Excel**, choose an `.xlsx` workbook and an active member/manager as the owner for new projects, then review before saving. No Excel, Python, Docker, or administrator installation is needed on the server. The original workbook and its project data are never committed to GitHub.

Keep the **Import list name**, sheet name, and **No./Project ID** references stable when uploading a later version. Where no reference column exists, the title becomes the reference. These keys make re-imports repeatable. Exact normalized title matches with manually created projects appear as existing records; ambiguous duplicate titles are skipped for review. Nothing is matched approximately or inferred from similar project names.

The header may follow up to 19 title/summary rows, as in a project register with headings on row four. `Project` maps to the title, `Impact` to priority, `Status` to delivery status, `Time saved (hrs/year)` to saved hours, and `Type` to new project/enhancement/support. `Discovery` maps to Planning. All named columns, including the originals and unknown columns, remain editable under Additional details. Optional `Team`/`Department` and `Sub-team` columns also populate those project fields; team dropdowns still await the supplied team list.

Numbered multiline **Enhancement details** create individual timeline changes. **Recorded enhancement iterations** can supply the count; missing descriptions are explicitly labelled “details pending.” Completed project rows produce Done changes; other rows produce Proposed changes because their individual status is unknown. All imported delivery and completion dates stay unset, including for historical completed projects. Add exact dates inside the project to position its changes on the visual timeline. Enhancement-type rows remain independent projects until a person chooses their source project.

Existing matches are skipped by default. The preview's **Update existing** option applies spreadsheet titles, statuses, impacts, types, savings, teams, and nonblank additional values. It preserves owners, members, descriptions, all dates, and other additional fields. Blank cells do not erase existing values. Imports append newly recorded enhancement iterations while preserving existing timeline edits; edit an existing iteration in the project to revise its details. Imports never delete projects or changes.

Each preview belongs to its creator and expires after one hour. Saving is one transaction with project revisions and audit history. Concurrent edits invalidate the preview and roll back all writes. Retrying a completed save returns its result rather than importing twice. Limits: 3 MB upload, 20 MB expanded ZIP, four sheets, 200 project rows, 50 named columns, 50 changes per row. ZIP expansion and sparse worksheet coordinates are checked before cell parsing. Formulas use Excel's saved values; they are never executed or recalculated, and paths/links are stored as text without fetching them.

Use **+ Add member** in the project header or the **Project team** card on Overview to select another registered active person. The header shortcut opens Overview and scrolls to that card. Profiles/designations and the official team/sub-team choice list are separate follow-up work; sub-team currently accepts text.

The main project page has six sections:

- **Overview:** delivery facts, a visual project journey, delivery milestones, and success criteria.
- **Details:** description, collaborators, and tags; Edit opens ownership, dates, estimates, and scope.
- **Reports:** reports/deliverables with status, owner, due date, notes, effort, and document links.
- **Enhancements:** independently scheduled improvements with release labels, scope, priority, dates, effort, savings, and completion state.
- **Activity:** progress updates and discussions.
- **History:** saved project versions and before/after change records.

Archive a project to remove it from active lists while keeping its history. Archived projects are available through the Projects status filter.

## The project journey

The original delivery has its own timeline row. An improvement can start before that delivery ends or after it is completed; it never overwrites the original completion date. Improvements created as separate projects can reference a source project and appear as linked rows in the source's journey. Related projects remain subject to access checks.

Every stage includes textual status and dates, in addition to color. A stage without planned dates retains its logged date as text and is explicitly labeled unscheduled, with no invented duration. Filters show all, active, or completed stages; milestone markers and the today line give context.

The timeline is the first section of Overview. Open **+ Add change to timeline** above the chart to add a request during the original work or after delivery. Each change has its own title, scope, release label, start, deadline, and status; its row links to the editable enhancement. The original delivery remains first, followed by changes in date order. A deadline-only record is shown as a point with “start not set”; undated records have no invented duration. Use **Set or edit project dates** to schedule the original delivery.

## Reports replace task screens

The sidebar and search use Reports. Existing `/dashboard/tasks` and `/dashboard/tasks/board` bookmarks redirect to the corresponding report screens. Previous work remains in the existing database table, with the same IDs, status, assignments, due dates, descriptions, hierarchy, and legacy story points. New fields store estimated hours and report links separately; story points are not silently converted to hours.

Open a report title to change its notes, status, document link, owner, or estimate. The workflow is To do → In progress → In review → Done, with Blocked available. Links must use HTTP or HTTPS. Assigning work follows the same permissions as the inline controls. Concurrent report edits are checked against the saved version.

## Weekly focus and daily changes

In **My week**, select a fiscal week, choose a project, describe the focus, select weekdays, set a start time, and estimate hours per day. The daily timeline derives its default entries from these weekly focus blocks without requiring daily re-entry.

Use **Change this day** to alter only that date's project, focus, start time, duration, or note, or to skip the block. **Reset to weekly plan** removes the override. Editing the weekly block changes the baseline; existing daily overrides stay independent. Weekly and daily changes are audited. The previous week's baseline can be copied into an empty week; daily overrides are not copied.

Daily capacity bars use an eight-hour reference and the team overview uses a forty-hour week reference. These are planning guides, not time-clock attendance or contractual working-hours rules. Overlaps are flagged. The local Windows server calendar day determines Today; the server should use the office's correct time zone.

Managers can choose a date in **Team overview** and see every active person's project ownership/collaboration, open reports, weekly load, daily focus, and whether that date was adjusted. Users edit their own weekly and daily commitments; management reviews and assigns project ownership.

## Fiscal calendar

The supplied company calendars are authoritative for FY2026–2028, including every period and week boundary. Each year links to its original PDF in the calendar screen.

| Fiscal year | First Sunday | Last Saturday | Weeks |
| --- | --- | --- | --- |
| 2026 | 1 February 2026 | 30 January 2027 | 52 |
| 2027 | 31 January 2027 | 29 January 2028 | 52 |
| 2028 | 30 January 2028 | 3 February 2029 | 53 |

The pattern is **4-5-4**, with Sunday–Saturday weeks. FY2028's extra week belongs to January / Period 12. These official years take precedence over old saved alignments and cannot be realigned through the form. Other years default to NRF, with the fiscal year beginning on the Sunday nearest February 1; managers can configure those years. The calendar shows month names, periods, quarters, numbered weeks, and project/report/milestone/enhancement deadlines.

The calendar is generated independently of the Gregorian month grid. For other years, managers can override a year's Sunday start date and 52/53-week count; align neighboring years as well if a future official calendar shifts.

## Manager intake and pool

In **Request pool**, create a link with a title, expiry, and optional recipient email. Copy it manually and share it with its intended recipient. The form works without an account. It collects requester details, project type and existing-project reference, scope/outcome, estimated effort, expected weekly savings, requested delivery date, and priority.

A link is a bearer capability: anyone holding it can submit until expiry/revocation. Specifying an email restricts the accepted email value but is not email identity verification. The form does not expose a project list, submitted requests, or workspace data. Managers can revoke their links; administrators can revoke any link. Links owned by an inactive or demoted manager stop accepting submissions. Submissions have validation, a honeypot, duplicate-click suppression, and a per-link hourly limit.

Requests stay in the pool as Pending, Assigned, or Rejected. Management can keep a request pending, add notes, decline it, or assign it as a project to an active person. Enhancements can be linked to an existing project during review. Assignment is transactional and version-checked, so repeated or competing approvals cannot create multiple projects. The original request remains attached to the created project for traceability. No email or chat messages are sent automatically.

## History and version control

Project detail, status, ownership, collaborator, and tag changes create immutable project snapshots and audit entries in the same transaction. The first edit after upgrading saves the current pre-upgrade state as a baseline. A restore creates a new version; it does not delete newer revisions. It restores project details, dates, owners, collaborators, and tags. Reports, enhancements, comments, progress updates, milestones, and work-plan changes retain separate before/after audit records rather than being silently rolled back with project details.

History records actor, time, and changed values. New enhancement/report edits and project edits use version checks to avoid silent overwrites. Code versions remain in GitHub. The wiki keeps its existing optimistic save-conflict and local draft recovery behavior; this release does not add a separate wiki revision browser.

Historical changes that were never recorded before this upgrade cannot be reconstructed. History starts from the upgrade and preserves existing progress updates and discussions. Backups remain important; application history is not a database backup or a tamper-proof external compliance archive.

## Update

See [Windows deployment](WINDOWS.md) for the user-account update command, database backup, port 8599, preserved logo, and failure handling. The update modifies app code and its database schema without changing Windows or network policies.

## People and supporting request information

Admin accounts manage the workspace and are excluded from work allocation and staff workload lists. Allocate projects, sub-ownership, collaborators, and reports to active team members or managers. Existing project history and administrative access are preserved; old ownership can be replaced by choosing a real person.

The public automation request form collects the requester's name, email, reporting manager, and team/department (a text field). The reporting manager is distinct from the manager reviewing the request link. It also accepts an SOP location, an optional SOP upload, and the locations of needed input files. Shared drive/Windows paths and document URLs are saved as text; the server does not open those locations.

SOP uploads support PDF, DOCX, and UTF-8 TXT up to 3 MB. File bytes stay in PostgreSQL and are included in the normal database backup. They are excluded from list queries, page props, and audit snapshots. Downloads require a signed-in manager or access to the assigned project; possession of the public intake link does not grant download access. The manager sees all supporting information in the pool, and it remains available in the assigned project's overview. Team/department also carries into the project details.

The form keeps entered text and the selected file when a submission fails, displays the error for correction, and confirms a successful submission before offering another form.
