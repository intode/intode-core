import type { Workspace } from './WorkspaceManager';

/**
 * Display order: sortOrder ascending. Entries without sortOrder (pre-migration
 * data) go last, most recently connected first — mirroring the legacy ordering
 * so the migration snapshot preserves what the user currently sees.
 */
export function sortWorkspaces(list: Workspace[]): Workspace[] {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
    if (a.sortOrder !== undefined) return -1;
    if (b.sortOrder !== undefined) return 1;
    return (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0);
  });
}

/**
 * Ensure every workspace has a unique sortOrder. When any is missing or
 * duplicated, renumbers 0..n-1 in current display order. Returns the input
 * list untouched (changed: false) when already normalized.
 */
export function normalizeSortOrder(list: Workspace[]): { list: Workspace[]; changed: boolean } {
  const orders = list.map(w => w.sortOrder).filter((o): o is number => o !== undefined);
  const complete = orders.length === list.length;
  const unique = new Set(orders).size === orders.length;
  if (complete && unique) return { list, changed: false };
  const renumbered = sortWorkspaces(list).map((w, i) => ({ ...w, sortOrder: i }));
  return { list: renumbered, changed: true };
}

/**
 * Reorder to match orderedIds and renumber 0..n-1. Ids absent from orderedIds
 * keep their current display order after the ordered ones (defensive; the UI
 * always passes the full id list). Does not touch updatedAt.
 */
export function applyOrder(list: Workspace[], orderedIds: string[]): Workspace[] {
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  const known = list.filter(w => rank.has(w.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const unknown = sortWorkspaces(list.filter(w => !rank.has(w.id)));
  const maxRank = known.length > 0 ? Math.max(...known.map(w => rank.get(w.id)!)) : -1;
  return [
    ...known.map((w) => ({ ...w, sortOrder: rank.get(w.id)! })),
    ...unknown.map((w, i) => ({ ...w, sortOrder: maxRank + 1 + i }))
  ];
}
