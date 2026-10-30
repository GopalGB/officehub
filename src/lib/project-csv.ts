import type { Project } from "@prisma/client";
import { additionalDetailsSchema } from "@/lib/additional-details";

export function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  let first = 0;
  while (
    first < text.length &&
    (text.charCodeAt(first) < 32 || text[first].trim() === "")
  )
    first++;
  // Quoting alone does not stop spreadsheet applications from running formulas.
  if (
    typeof value === "string" &&
    (["=", "+", "@", "-"].includes(text[first]) ||
      ["\t", "\r", "\n"].includes(text[0]))
  )
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export type BoardProject = Project & {
  canEdit?: boolean;
  owner: { id: string; name: string };
  coOwner: { id: string; name: string } | null;
  members: { id: string; name: string }[];
};
export function projectBoardCSV(projects: BoardProject[]) {
  const details = projects.map((project) =>
    additionalDetailsSchema.parse(project.additionalDetails),
  );
  const labels = new Map<string, string>();
  for (const fields of details)
    for (const field of fields) {
      const key = field.label.normalize("NFKC").toLowerCase();
      if (!labels.has(key)) labels.set(key, field.label);
    }
  const date = (value: Date | string | null) =>
    value ? new Date(value).toISOString().slice(0, 10) : "";
  const headers = [
    "Project ID",
    "Project",
    "Summary",
    "Status",
    "Priority",
    "Type",
    "Owner",
    "Sub-owner",
    "Members",
    "Start date",
    "Target date",
    "Completed date",
    "Estimated hours",
    "Saved hours",
    "Team",
    "Sub-team",
    "Version",
    ...[...labels.values()].map((label) => "Detail: " + label),
  ];
  const rows = projects.map((project, index) => {
    const fields = new Map(
      details[index].map((field) => [
        field.label.normalize("NFKC").toLowerCase(),
        field.value,
      ]),
    );
    return [
      project.id,
      project.title,
      project.summary,
      project.status,
      project.priority,
      project.projectType,
      project.owner.name,
      project.coOwner?.name,
      project.members.map((person) => person.name).join("; "),
      date(project.startDate),
      date(project.targetDate),
      date(project.actualEndDate),
      project.estimatedHours,
      project.savedHours,
      project.department,
      project.subTeam,
      project.version,
      ...[...labels.keys()].map((key) => fields.get(key) ?? ""),
    ];
  });
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
