export interface TabEntry {
  id: string;
}

/**
 * The insertion index for a dragged tab, computed against the tab list with
 * the dragged tab still in place: `hoverIndex` is the tab under the cursor
 * and `before` is whether the cursor is on its leading half. The returned
 * index addresses the list with the dragged tab already removed, so callers
 * can splice directly. Returns `null` when the dragged tab is hovered itself
 * (or is unknown) — no move.
 */
export function dropIndexForTabs(
  tabs: TabEntry[],
  draggedId: string,
  hoverIndex: number,
  before: boolean,
): number | null {
  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedId);
  if (draggedIndex === -1 || hoverIndex === draggedIndex) {
    return null;
  }
  const target = before ? hoverIndex : hoverIndex + 1;
  return hoverIndex > draggedIndex ? target - 1 : target;
}

/** Returns a new tab list with `sourceId` moved to `dropIndex` (clamped). */
export function moveTab<T extends TabEntry>(tabs: T[], sourceId: string, dropIndex: number): T[] {
  const source = tabs.find((tab) => tab.id === sourceId);
  if (!source) {
    return tabs;
  }
  const remaining = tabs.filter((tab) => tab.id !== sourceId);
  const index = Math.max(0, Math.min(dropIndex, remaining.length));
  const next = [...remaining];
  next.splice(index, 0, source);
  return next;
}
