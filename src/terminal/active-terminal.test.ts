import { describe, it, expect, beforeEach } from 'vitest';
import {
  setActiveNativeTerminal,
  getActiveNativeTerminal,
  subscribeActiveNativeTerminal,
} from './active-terminal';

describe('active-terminal', () => {
  beforeEach(() => {
    setActiveNativeTerminal(null);
  });

  it('returns null initially', () => {
    expect(getActiveNativeTerminal()).toBeNull();
  });

  it('stores the last set id', () => {
    setActiveNativeTerminal('tab-1');
    expect(getActiveNativeTerminal()).toBe('tab-1');
    setActiveNativeTerminal('tab-2');
    expect(getActiveNativeTerminal()).toBe('tab-2');
  });

  it('accepts null to clear', () => {
    setActiveNativeTerminal('tab-1');
    setActiveNativeTerminal(null);
    expect(getActiveNativeTerminal()).toBeNull();
  });

  it('notifies subscribers on change', () => {
    const seen: (string | null)[] = [];
    subscribeActiveNativeTerminal((id) => seen.push(id));
    setActiveNativeTerminal('tab-1');
    setActiveNativeTerminal('tab-2');
    setActiveNativeTerminal(null);
    expect(seen).toEqual(['tab-1', 'tab-2', null]);
  });

  it('skips subscriber notification when id is unchanged', () => {
    const seen: (string | null)[] = [];
    subscribeActiveNativeTerminal((id) => seen.push(id));
    setActiveNativeTerminal('tab-1');
    setActiveNativeTerminal('tab-1');
    expect(seen).toEqual(['tab-1']);
  });

  it('returns unsubscribe function', () => {
    const seen: (string | null)[] = [];
    const unsub = subscribeActiveNativeTerminal((id) => seen.push(id));
    setActiveNativeTerminal('tab-1');
    unsub();
    setActiveNativeTerminal('tab-2');
    expect(seen).toEqual(['tab-1']);
  });

  it('swallows subscriber errors and still notifies others', () => {
    const seen: (string | null)[] = [];
    subscribeActiveNativeTerminal(() => { throw new Error('boom'); });
    subscribeActiveNativeTerminal((id) => seen.push(id));
    setActiveNativeTerminal('tab-1');
    expect(seen).toEqual(['tab-1']);
  });
});
