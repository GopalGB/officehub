/** Missing dates remain explicit. A deadline alone is a point, not a duration
 * invented between the database creation timestamp and an earlier deadline. */
export function deliveryRange(input: {
  startDate: Date | null;
  targetDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}) {
  const end =
    input.completedAt ?? input.targetDate ?? input.startDate ?? input.createdAt;
  const start = input.startDate ?? end;
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    loggedAt: input.createdAt.toISOString(),
    hasStart: !!input.startDate,
    hasEnd: !!(input.completedAt ?? input.targetDate),
    endLabel: input.completedAt ? "Completed" : "Due",
    scheduled: !!(input.startDate || input.targetDate || input.completedAt),
    invalidRange: end < start,
  };
}

export function chronologicalStages<
  T extends {
    kind: string;
    scheduled: boolean;
    start: string;
    loggedAt: string;
  },
>(stages: T[]): T[] {
  return [...stages].sort((a, b) => {
    if (a.kind === "Original delivery")
      return b.kind === "Original delivery" ? 0 : -1;
    if (b.kind === "Original delivery") return 1;
    return (
      Date.parse(a.scheduled ? a.start : a.loggedAt) -
        Date.parse(b.scheduled ? b.start : b.loggedAt) ||
      Date.parse(a.loggedAt) - Date.parse(b.loggedAt)
    );
  });
}

export function isCompletedStage(status: string) {
  return ["DONE", "COMPLETED", "ARCHIVED"].includes(status);
}

/** Keep minimum-width markers inside the track, including a point at its end. */
export function timelineBarPosition(
  start: string,
  end: string,
  min: number,
  span: number,
) {
  const position = (value: string) =>
    Math.min(
      100,
      Math.max(0, ((Date.parse(value) - min) / Math.max(span, 1)) * 100),
    );
  const left = Math.min(98, position(start));
  return {
    left,
    width: Math.min(100 - left, Math.max(2, position(end) - left)),
  };
}
