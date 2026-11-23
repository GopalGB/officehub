import { createMeeting } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { wallTimeInput, wallNow } from "@/lib/utils";

export function MeetingForm({
  people,
  projects,
  projectId,
  kind = "SCHEDULED",
  title = "",
  attendeeIds = [],
  label = "Add meeting",
}: {
  people: { id: string; name: string }[];
  projects?: { id: string; title: string }[];
  projectId?: string;
  kind?: "SCHEDULED" | "ADHOC";
  title?: string;
  attendeeIds?: string[];
  label?: string;
}) {
  const start = wallNow();
  start.setUTCMinutes(kind === "ADHOC" ? start.getUTCMinutes() : 0);
  if (kind !== "ADHOC") start.setUTCHours(start.getUTCHours() + 1);
  const end = new Date(start.getTime() + 30 * 60_000);
  return (
    <ActionForm action={createMeeting} label={label} successMessage="Meeting saved." className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {projectId ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        projects && (
          <label className="field">
            Project (optional)
            <select name="projectId" defaultValue="">
              <option value="">Not linked to a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        )
      )}
      <label className="field">
        Title
        <input name="title" required minLength={2} maxLength={160} defaultValue={title} placeholder="e.g. Weekly sync" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Starts
          <input name="startsAt" type="datetime-local" required defaultValue={wallTimeInput(start)} />
        </label>
        <label className="field">
          Ends (optional)
          <input name="endsAt" type="datetime-local" defaultValue={wallTimeInput(end)} />
        </label>
      </div>
      <label className="field">
        Teams / meeting link (optional)
        <input name="link" type="url" maxLength={2000} placeholder="https://teams.microsoft.com/…" />
      </label>
      <fieldset>
        <legend className="mb-2 text-xs font-medium">Who should attend</legend>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs">
              <input type="checkbox" name="attendeeIds" value={p.id} defaultChecked={attendeeIds.includes(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        Agenda / notes (optional)
        <textarea name="notes" rows={2} maxLength={2000} />
      </label>
    </ActionForm>
  );
}
