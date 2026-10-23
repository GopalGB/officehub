import type { Active, Over } from "@dnd-kit/core";

export type Placement = "above" | "below";

/**
 * Decide whether a dropped card lands above or below the card it was dropped on,
 * based on which half of the target the dragged card's center is over.
 */
export function computePlacement(active: Active, over: Over): Placement {
  const overRect = over.rect;
  if (!overRect) return "below";
  // Fast drag release or container scrolling: dnd-kit may not have computed the
  // translated rect yet. Fall back to the initial rect instead of always
  // resolving "below" (OH-10).
  const rect = active.rect.current.translated ?? active.rect.current.initial;
  if (!rect) return "below";
  const activeCenter = rect.top + rect.height / 2;
  const overCenter = overRect.top + overRect.height / 2;
  return activeCenter < overCenter ? "above" : "below";
}
