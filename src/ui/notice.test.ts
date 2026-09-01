import { describe, it, expect, beforeEach } from 'vitest';
import { notify, dismissNotice, subscribeNotices, getNotices } from './notice';

function clear(): void {
  for (const n of getNotices()) dismissNotice(n.id);
}

describe('notice', () => {
  beforeEach(clear);

  it('delivers the current list on subscribe, then on every change', () => {
    const seen: number[] = [];
    const stop = subscribeNotices((n) => seen.push(n.length));
    expect(seen).toEqual([0]);

    notify('error', 'Rename failed');
    expect(seen).toEqual([0, 1]);

    stop();
    notify('error', 'Delete failed');
    expect(seen).toEqual([0, 1]);
  });

  it('caps the list so a burst of failures cannot become a wall of text', () => {
    for (let i = 0; i < 10; i++) notify('error', `fail ${i}`);
    const list = getNotices();
    expect(list).toHaveLength(3);
    expect(list.map((n) => n.title)).toEqual(['fail 7', 'fail 8', 'fail 9']);
  });

  it('dismisses by id and leaves the rest alone', () => {
    const a = notify('error', 'a');
    notify('error', 'b');
    dismissNotice(a);
    expect(getNotices().map((n) => n.title)).toEqual(['b']);
  });

  it('ignores an unknown id without notifying subscribers', () => {
    notify('error', 'a');
    let calls = 0;
    const stop = subscribeNotices(() => calls++);
    dismissNotice('does-not-exist');
    expect(calls).toBe(1); // the initial delivery only
    stop();
  });

  it('hands out unique ids', () => {
    const ids = new Set([notify('info', 'x'), notify('info', 'y'), notify('info', 'z')]);
    expect(ids.size).toBe(3);
  });
});
