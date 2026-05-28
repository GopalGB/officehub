import type { Active, Over } from "@dnd-kit/core";

export type Placement = "above" | "below";

/**
 * Decide whether a dropped card lands above or below the card it was dropped on,
 * based on which half of the target the dragged card's center is over.
 */
export function computePlacement(active: Active, over: Over): Placement {
  const activeRect = active.rect.current.translated;
  const overRect = over.rect;
  if (!activeRect || !overRect) return "below";
  const activeCenter = activeRect.top + activeRect.height / 2;
  const overCenter = overRect.top + overRect.height / 2;
  return activeCenter < overCenter ? "above" : "below";
}
