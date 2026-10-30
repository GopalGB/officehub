import type { Active, Over, Modifier } from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";

export type Placement = "above" | "below";

type Box = { left: number; top: number; width: number; height: number };
export function boundedDragTransform(
  transform: Transform,
  rect: Box,
  bounds: Box,
): Transform {
  const left = Math.max(
    bounds.left,
    Math.min(
      rect.left + transform.x,
      bounds.left + Math.max(0, bounds.width - rect.width),
    ),
  );
  const top = Math.max(
    bounds.top,
    Math.min(
      rect.top + transform.y,
      bounds.top + Math.max(0, bounds.height - rect.height),
    ),
  );
  return { ...transform, x: left - rect.left, y: top - rect.top };
}
export const restrictOverlayToViewport: Modifier = ({
  transform,
  draggingNodeRect,
  windowRect,
}) =>
  draggingNodeRect && windowRect
    ? boundedDragTransform(transform, draggingNodeRect, windowRect)
    : transform;

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
