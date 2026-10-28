"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, FileText, Paperclip, X } from "lucide-react";
import { submitProjectRequest } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="surface min-w-0 space-y-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-secondary text-xs font-semibold">
          {number}
        </span>
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
export function RequestForm({
  token,
  email,
}: {
  token: string;
  email: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");
  const [projectType, setProjectType] = useState("NEW_PROJECT");
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  if (done)
    return (
      <div className="surface py-14 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          Request received
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your project details and supporting information are saved. The manager
          will review the request and assign an owner.
        </p>
        <Button
          className="mt-7"
          variant="outline"
          onClick={() => {
            setDone(false);
            setFileName("");
            setProjectType("NEW_PROJECT");
          }}
        >
          Submit another request
        </Button>
      </div>
    );
  return (
    <form
      className="min-w-0 space-y-5"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        start(async () => {
          setError("");
          try {
            const result = await submitProjectRequest(token, fd);
            if ("error" in result) setError(result.error);
            else setDone(true);
          } catch {
            setError(
              "Could not submit. Your entries are still here. Please try again.",
            );
          }
        });
      }}
    >
      <FormSection
        number="01"
        title="About you"
        description="Tell us who is requesting the work and which team it supports."
      >
        <label className="field">
          Your name *
          <input
            name="submitterName"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            placeholder="First and last name"
          />
        </label>
        <label className="field">
          Your email *
          <input
            name="submitterEmail"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            defaultValue={email ?? ""}
            readOnly={!!email}
            placeholder="you@company.com"
          />
        </label>
        <label className="field">
          Your manager’s name *
          <input
            name="managerName"
            minLength={2}
            maxLength={100}
            required
            placeholder="Your reporting manager"
          />
        </label>
        <label className="field">
          Your team / department *
          <input
            name="department"
            minLength={2}
            maxLength={100}
            required
            placeholder="e.g. Business Intelligence"
          />
        </label>
      </FormSection>
      <FormSection
        number="02"
        title="What would you like to improve?"
        description="Describe the process, the problem, and what a successful result would look like."
      >
        <label className="field sm:col-span-2">
          Project / report name *
          <input
            name="title"
            minLength={2}
            maxLength={160}
            required
            placeholder="e.g. Automate the weekly sales report"
          />
        </label>
        <label className="field">
          Type of work
          <select
            name="projectType"
            value={projectType}
            onChange={(event) => setProjectType(event.target.value)}
          >
            <option value="NEW_PROJECT">New project</option>
            <option value="ENHANCEMENT">
              Enhancement to an existing project
            </option>
            <option value="SUPPORT">Support / maintenance</option>
          </select>
        </label>
        <label className="field">
          Existing project name{" "}
          {projectType === "NEW_PROJECT" ? "(optional)" : "(if known)"}
          <input
            name="existingProject"
            maxLength={200}
            placeholder="Project name or reference"
          />
        </label>
        <label className="field sm:col-span-2">
          Requirements and expected outcome *
          <textarea
            name="description"
            rows={5}
            minLength={10}
            maxLength={5000}
            required
            placeholder="How does the process work today? What should change? What needs to be delivered?"
          />
        </label>
      </FormSection>
      <FormSection
        number="03"
        title="SOP & supporting files"
        description="Share the process instructions and where the source files can be found. These fields are optional."
      >
        <label className="field sm:col-span-2">
          SOP location
          <input
            name="sopLocation"
            maxLength={2000}
            placeholder="Shared drive path or document URL"
          />
          <span className="text-xs font-normal text-muted-foreground">
            Paste a location, upload the SOP below, or provide both.
          </span>
        </label>
        <div className="sm:col-span-2">
          <label htmlFor="sopFile" className="field">
            Upload SOP
          </label>
          <div className="mt-2 rounded-xl border border-dashed bg-secondary/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span>PDF, DOCX, or TXT · up to 3 MB</span>
            </div>
            <input
              ref={fileRef}
              id="sopFile"
              name="sopFile"
              type="file"
              accept=".pdf,.docx,.txt"
              className="block w-full min-w-0 text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && file.size > 3 * 1024 * 1024) {
                  event.target.value = "";
                  setFileName("");
                  setError(
                    "Choose an SOP file smaller than 3 MB, or paste its shared location.",
                  );
                } else {
                  setFileName(file?.name ?? "");
                  setError("");
                }
              }}
            />
            {fileName && (
              <div className="mt-3 flex min-w-0 items-center gap-2 text-xs">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 break-all">{fileName}</span>
                <button
                  type="button"
                  aria-label="Remove SOP attachment"
                  onClick={() => {
                    if (fileRef.current) fileRef.current.value = "";
                    setFileName("");
                  }}
                  className="rounded-md p-2 hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        <label className="field sm:col-span-2">
          Needed files location / paths
          <textarea
            name="requiredFilesLocation"
            rows={2}
            maxLength={2000}
            placeholder="List the shared folders, input files, or document URLs needed for this work."
          />
          <span className="text-xs font-normal text-muted-foreground">
            Include the location of each source file and any access
            instructions.
          </span>
        </label>
      </FormSection>
      <FormSection
        number="04"
        title="Effort, impact & timing"
        description="Your best estimate helps the manager prioritize and plan the work."
      >
        <label className="field">
          Estimated effort (hours) *
          <input
            name="estimatedHours"
            type="number"
            min="0.25"
            step="0.25"
            max="100000"
            required
            placeholder="e.g. 8"
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
            placeholder="e.g. 3"
          />
        </label>
        <label className="field">
          Requested delivery date
          <input name="requestedDate" type="date" />
        </label>
        <label className="field">
          Priority
          <select name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low — flexible timing</option>
            <option value="MEDIUM">Medium — normal priority</option>
            <option value="HIGH">High — time sensitive</option>
            <option value="CRITICAL">Critical — business blocked</option>
          </select>
        </label>
      </FormSection>
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </div>
      )}
      <div className="surface flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Ready for review? Your manager will confirm scope, priority, and
          ownership after submission.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending request…" : "Submit request"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
