import { createHelpRequest } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";

export function HelpRequestForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={createHelpRequest.bind(null, projectId)} label="Post to help pool" successMessage="Posted. The team can see it in the help pool." className="mt-3 space-y-3">
      <label className="field">
        What do you need help with?
        <textarea name="details" required minLength={5} maxLength={2000} rows={3} placeholder="e.g. Need someone to build the Aero weekly extract while I finish the dashboard" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Skills (optional)
          <input name="skills" maxLength={200} placeholder="SQL, Power BI, Python…" />
        </label>
        <label className="field">
          Needed by (optional)
          <input name="neededBy" type="date" />
        </label>
      </div>
    </ActionForm>
  );
}
