import { z } from "zod";

export const REPORT_KINDS = [
  { value: "REPORT", label: "Report" },
  { value: "DASHBOARD", label: "Dashboard" },
  { value: "ADHOC", label: "Ad-hoc request" },
  { value: "OTHER", label: "Other" },
] as const;

export const ReportKindEnum = z.enum(["REPORT", "DASHBOARD", "ADHOC", "OTHER"]);

export function reportKindLabel(kind: string) {
  return REPORT_KINDS.find((k) => k.value === kind)?.label ?? "Report";
}
