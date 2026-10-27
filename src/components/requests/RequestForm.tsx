"use client";
import { useState, useTransition } from "react";
import { submitProjectRequest } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
export function RequestForm({
  token,
  email,
}: {
  token: string;
  email: string | null;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  if (done)
    return (
      <div className="surface py-12 text-center">
        <p className="text-2xl">✓</p>
        <h2 className="mt-3 text-xl font-semibold">Request received</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Your request is saved in the manager’s pool for review and assignment.
          You can close this page.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => setDone(false)}
        >
          Submit another request
        </Button>
      </div>
    );
  return (
    <form
      className="surface space-y-5"
      action={(fd) =>
        start(async () => {
          setError("");
          try {
            const result = await submitProjectRequest(token, fd);
            if ("error" in result) setError(result.error);
            else setDone(true);
          } catch {
            setError("Could not submit. Please try again.");
          }
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Your name
          <input
            name="submitterName"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label className="field">
          Your email
          <input
            name="submitterEmail"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            defaultValue={email ?? ""}
            readOnly={!!email}
          />
        </label>
        <label className="field sm:col-span-2">
          Project / report name
          <input name="title" minLength={2} maxLength={160} required />
        </label>
        <label className="field">
          Type of work
          <select name="projectType">
            <option value="NEW_PROJECT">New project</option>
            <option value="ENHANCEMENT">
              Enhancement to an existing project
            </option>
            <option value="SUPPORT">Support / maintenance</option>
          </select>
        </label>
        <label className="field">
          Existing project name (if applicable)
          <input
            name="existingProject"
            maxLength={200}
            placeholder="Name or reference"
          />
        </label>
        <label className="field sm:col-span-2">
          What do you need, and what should the outcome be?
          <textarea
            name="description"
            rows={6}
            minLength={10}
            maxLength={5000}
            required
          />
        </label>
        <label className="field">
          Estimated effort (hours)
          <input
            name="estimatedHours"
            type="number"
            min="0.25"
            step="0.25"
            max="100000"
            required
          />
        </label>
        <label className="field">
          Expected time saved (hours / week)
          <input
            name="savedHours"
            type="number"
            min="0"
            step="0.25"
            max="100000"
          />
        </label>
        <label className="field">
          Requested delivery date
          <input name="requestedDate" type="date" />
        </label>
        <label className="field">
          Priority
          <select name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </label>
      </div>
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Send request to manager"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Your request will be saved for review. Submitting does not create an
        account or assign the project.
      </p>
    </form>
  );
}
