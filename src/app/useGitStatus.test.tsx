// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';

import { useGitStatus, GIT_STATUS_INTERVAL, GIT_STATUS_MIN_GAP } from './useGitStatus';
import { setGitStatusProvider } from '../files/git-status-provider';
import type { GitStatusMap } from '../files/FileTree';

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the provider's resolved promise land inside act(). */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

const provider = vi.fn(async (): Promise<GitStatusMap> => new Map([['a.ts', 'M']]));

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  provider.mockClear();
  setGitStatusProvider(provider);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useGitStatus', () => {
  it('polls while the page is visible and the tree is on screen', async () => {
    renderHook(() => useGitStatus('s1', '~/repo', true));
    await flush();
    expect(provider).toHaveBeenCalledTimes(1);

    await advance(GIT_STATUS_INTERVAL);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('stops polling while the app is in the background', async () => {
    renderHook(() => useGitStatus('s1', '~/repo', true));
    await flush();

    await act(async () => setVisibility('hidden'));
    await advance(GIT_STATUS_INTERVAL * 10);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('refreshes at once when the app comes back, then resumes the interval', async () => {
    renderHook(() => useGitStatus('s1', '~/repo', true));
    await flush();
    await act(async () => setVisibility('hidden'));
    await advance(GIT_STATUS_INTERVAL * 3);

    await act(async () => setVisibility('visible'));
    await flush();
    expect(provider).toHaveBeenCalledTimes(2);

    await advance(GIT_STATUS_INTERVAL);
    expect(provider).toHaveBeenCalledTimes(3);
  });

  it('does not poll while the file tree is not on screen', async () => {
    renderHook(() => useGitStatus('s1', '~/repo', false));
    await flush();
    await advance(GIT_STATUS_INTERVAL * 5);
    expect(provider).not.toHaveBeenCalled();
  });

  it('refreshes at once when the file tree comes on screen', async () => {
    const { rerender } = renderHook(({ active }) => useGitStatus('s1', '~/repo', active), {
      initialProps: { active: false },
    });
    await flush();

    rerender({ active: true });
    await flush();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('keeps the same map when a poll returns the same status', async () => {
    const { result } = renderHook(() => useGitStatus('s1', '~/repo', true));
    await flush();
    const first = result.current;
    expect(first.get('a.ts')).toBe('M');

    await advance(GIT_STATUS_INTERVAL);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(first);
  });

  it('does not show one session’s status for another', async () => {
    const { result, rerender } = renderHook(({ sid, active }) => useGitStatus(sid, '~/repo', active), {
      initialProps: { sid: 's1', active: true },
    });
    await flush();
    expect(result.current.size).toBe(1);

    // Reconnect or workspace switch while the tree is hidden: nothing is fetched for s2 yet,
    // so s1's badges must not be handed out under s2.
    rerender({ sid: 's2', active: false });
    expect(result.current.size).toBe(0);
  });

  // Tree → open a file → back to the tree is a common loop. Refetching on every return stacked
  // remote `git status` runs where the interval alone would have sent one per 30 s.
  it('does not refetch when the tree comes back within the minimum gap', async () => {
    const { rerender } = renderHook(({ active }) => useGitStatus('s1', '~/repo', active), {
      initialProps: { active: true },
    });
    await flush();
    expect(provider).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    await advance(GIT_STATUS_MIN_GAP / 2);
    rerender({ active: true });
    await flush();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('refetches when the tree comes back after the minimum gap', async () => {
    const { rerender } = renderHook(({ active }) => useGitStatus('s1', '~/repo', active), {
      initialProps: { active: true },
    });
    await flush();

    rerender({ active: false });
    await advance(GIT_STATUS_MIN_GAP + 1);
    rerender({ active: true });
    await flush();
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('skips a tick while the previous status is still running', async () => {
    let finish: (m: GitStatusMap) => void = () => {};
    provider.mockImplementationOnce(() => new Promise<GitStatusMap>((resolve) => { finish = resolve; }));
    renderHook(() => useGitStatus('s1', '~/repo', true));
    await flush();

    await advance(GIT_STATUS_INTERVAL * 2);
    expect(provider).toHaveBeenCalledTimes(1);

    await act(async () => { finish(new Map()); });
    await advance(GIT_STATUS_INTERVAL);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('keeps a result that lands after the tree was left and re-entered', async () => {
    let finish: (m: GitStatusMap) => void = () => {};
    provider.mockImplementationOnce(() => new Promise<GitStatusMap>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ active }) => useGitStatus('s1', '~/repo', active), {
      initialProps: { active: true },
    });
    await flush();

    rerender({ active: false });
    rerender({ active: true });
    await act(async () => { finish(new Map([['b.ts', 'A']])); });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(result.current.get('b.ts')).toBe('A');
  });

  it('drops a late result once a newer session has fetched', async () => {
    let finishOld: (m: GitStatusMap) => void = () => {};
    provider.mockImplementationOnce(() => new Promise<GitStatusMap>((resolve) => { finishOld = resolve; }));
    const { result, rerender } = renderHook(({ sid }) => useGitStatus(sid, '~/repo', true), {
      initialProps: { sid: 's1' },
    });
    await flush();

    rerender({ sid: 's2' });
    await flush();
    expect(result.current.get('a.ts')).toBe('M');

    await act(async () => { finishOld(new Map([['stale.ts', 'D']])); });
    expect(result.current.get('a.ts')).toBe('M');
    expect(result.current.has('stale.ts')).toBe(false);
  });
});
