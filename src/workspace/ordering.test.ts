import { describe, it, expect } from 'vitest';
import type { Workspace } from './WorkspaceManager';
import { sortWorkspaces, normalizeSortOrder, applyOrder } from './ordering';

function ws(id: string, extra: Partial<Workspace> = {}): Workspace {
  return {
    id, name: id, host: 'h', port: 22, username: 'u', authType: 'password',
    defaultPath: '~', lastConnectedAt: null, createdAt: 0, updatedAt: 0,
    ...extra,
  };
}

describe('sortWorkspaces', () => {
  it('sorts by sortOrder ascending', () => {
    const out = sortWorkspaces([ws('a', { sortOrder: 2 }), ws('b', { sortOrder: 0 }), ws('c', { sortOrder: 1 })]);
    expect(out.map(w => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('places entries without sortOrder after ordered ones, by lastConnectedAt desc', () => {
    const out = sortWorkspaces([
      ws('legacy-old', { lastConnectedAt: 100 }),
      ws('ordered', { sortOrder: 0 }),
      ws('legacy-new', { lastConnectedAt: 300 }),
    ]);
    expect(out.map(w => w.id)).toEqual(['ordered', 'legacy-new', 'legacy-old']);
  });

  it('keeps insertion order for legacy entries when lastConnectedAt is all null (stable sort)', () => {
    const out = sortWorkspaces([ws('first'), ws('second'), ws('third')]);
    expect(out.map(w => w.id)).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the input array', () => {
    const input = [ws('a', { sortOrder: 1 }), ws('b', { sortOrder: 0 })];
    sortWorkspaces(input);
    expect(input.map(w => w.id)).toEqual(['a', 'b']);
  });
});

describe('normalizeSortOrder', () => {
  it('is a no-op when every entry has a unique sortOrder', () => {
    const input = [ws('a', { sortOrder: 0 }), ws('b', { sortOrder: 5 })];
    const { list, changed } = normalizeSortOrder(input);
    expect(changed).toBe(false);
    expect(list).toBe(input);
  });

  it('snapshots current display order for legacy data (no sortOrder at all)', () => {
    const { list, changed } = normalizeSortOrder([
      ws('old', { lastConnectedAt: 100 }),
      ws('new', { lastConnectedAt: 300 }),
      ws('never'),
    ]);
    expect(changed).toBe(true);
    expect(list.map(w => [w.id, w.sortOrder])).toEqual([['new', 0], ['old', 1], ['never', 2]]);
  });

  it('renumbers 0..n-1 when some entries are missing sortOrder', () => {
    const { list, changed } = normalizeSortOrder([ws('legacy'), ws('kept', { sortOrder: 3 })]);
    expect(changed).toBe(true);
    expect(list.map(w => [w.id, w.sortOrder])).toEqual([['kept', 0], ['legacy', 1]]);
  });

  it('renumbers when sortOrder values collide', () => {
    const { changed, list } = normalizeSortOrder([ws('a', { sortOrder: 0 }), ws('b', { sortOrder: 0 })]);
    expect(changed).toBe(true);
    expect(new Set(list.map(w => w.sortOrder)).size).toBe(2);
  });

  it('does not touch updatedAt when renumbering', () => {
    const { list } = normalizeSortOrder([ws('a', { updatedAt: 77 })]);
    expect(list[0].updatedAt).toBe(77);
  });
});

describe('applyOrder', () => {
  it('renumbers to match orderedIds', () => {
    const out = applyOrder(
      [ws('a', { sortOrder: 0 }), ws('b', { sortOrder: 1 }), ws('c', { sortOrder: 2 })],
      ['c', 'a', 'b'],
    );
    expect(out.map(w => [w.id, w.sortOrder])).toEqual([['c', 0], ['a', 1], ['b', 2]]);
  });

  it('appends ids missing from orderedIds, keeping their display order', () => {
    const out = applyOrder(
      [ws('a', { sortOrder: 0 }), ws('b', { sortOrder: 1 }), ws('c', { sortOrder: 2 })],
      ['b'],
    );
    expect(out.map(w => [w.id, w.sortOrder])).toEqual([['b', 0], ['a', 1], ['c', 2]]);
  });

  it('ignores unknown ids in orderedIds', () => {
    const out = applyOrder([ws('a', { sortOrder: 0 })], ['ghost', 'a']);
    expect(out.map(w => [w.id, w.sortOrder])).toEqual([['a', 1]]);
  });

  it('does not touch updatedAt', () => {
    const out = applyOrder([ws('a', { sortOrder: 0, updatedAt: 42 })], ['a']);
    expect(out[0].updatedAt).toBe(42);
  });
});
