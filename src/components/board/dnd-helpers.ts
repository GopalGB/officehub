import type { Active, ClientRect, Over } from "@dnd-kit/core";

export type Placement = "above" | "below";

export function computePlacement(active: Active, over: Over): Placement {
  const activeRect: ClientRect | null = active.rect.current.translated;
  const overRect = over.rect;
  if (!activeRect || !overRect) return "below";
  const activeCenter = activeRect.top + activeRect.height / 2;
  const overCenter = overRect.top + overRect.height / 2;
  return activeCenter < overCenter ? "above" : "below";
}

const ORDER_STEP = 1024;

export function nextOrderIndexClient(opts: {
  siblings: { id: string; orderIndex: number }[];
  targetId: string | null;
  placement: Placement;
}): number {
  const { siblings, targetId, placement } = opts;
  if (!targetId) {
    return siblings.length ? siblings[siblings.length - 1].orderIndex + ORDER_STEP : 0;
  }
  const idx = siblings.findIndex((s) => s.id === targetId);
  if (idx < 0) {
    return siblings.length ? siblings[siblings.length - 1].orderIndex + ORDER_STEP : 0;
  }
  const target = siblings[idx];
  if (placement === "above") {
    const above = idx > 0 ? siblings[idx - 1] : null;
    if (!above) return target.orderIndex - ORDER_STEP;
    return (above.orderIndex + target.orderIndex) / 2;
  }
  const below = idx < siblings.length - 1 ? siblings[idx + 1] : null;
  if (!below) return target.orderIndex + ORDER_STEP;
  return (target.orderIndex + below.orderIndex) / 2;
}

export function isStatusId(id: string, knownStatuses: readonly string[]): boolean {
  return knownStatuses.includes(id);
}
