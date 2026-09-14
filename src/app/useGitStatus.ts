import { useState, useEffect, useRef } from 'react';
import { getGitStatusProvider } from '../files/git-status-provider';
import type { GitStatusMap } from '../files/FileTree';

export const GIT_STATUS_INTERVAL = 30_000;
/** A return to the tree sooner than this after the last fetch shows the badges it already has. */
export const GIT_STATUS_MIN_GAP = 5_000;

const EMPTY: GitStatusMap = new Map();

function sameStatus(a: GitStatusMap, b: GitStatusMap): boolean {
  if (a.size !== b.size) return false;
  for (const [file, status] of a) {
    if (b.get(file) !== status) return false;
  }
  return true;
}

/**
 * Git status badges for the file tree, refreshed on an interval.
 *
 * Every refresh is a remote `git status` over SSH, so it only runs while someone can see the
 * result: the page is visible and `active` (the tree is on screen). Without that gate the
 * interval kept firing from a hidden WebView — Capacitor does not pause WebView timers when the
 * app goes to the background — and each tick opened an exec channel, which on a phone means
 * waking the radio for badges nobody was looking at.
 *
 * Coming back refreshes at once unless the last fetch is under GIT_STATUS_MIN_GAP old, and a
 * fetch still running is never stacked with another, so flipping between the tree and a file
 * costs at most one run per gap.
 */
export function useGitStatus(
  sessionId: string | undefined,
  defaultPath: string | undefined,
  active = true,
): GitStatusMap {
  // The map remembers whose status it is, so a reconnect or workspace switch never shows the
  // previous session's badges while the new ones have not been fetched.
  const owner = sessionId && defaultPath ? JSON.stringify([sessionId, defaultPath]) : null;
  const [state, setState] = useState<{ owner: string | null; map: GitStatusMap }>({ owner: null, map: EMPTY });
  // Outlives the effect: toggling `active` restarts the effect, but a fetch it started may still
  // be running and still counts as the latest one.
  const lastFetch = useRef<{ owner: string; at: number; running: boolean } | null>(null);

  useEffect(() => {
    const provider = getGitStatusProvider();
    if (!provider || !sessionId || !defaultPath || !owner || !active) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      const last = lastFetch.current;
      if (last && last.owner === owner && last.running) return;
      const fetch = { owner, at: Date.now(), running: true };
      lastFetch.current = fetch;
      provider(sessionId, defaultPath)
        .then((next) => {
          // Only the latest fetch may land. Not tied to this effect run: leaving the tree and
          // coming straight back restarts the effect, and dropping the result then would leave
          // the badges stale until the next tick, since the gap check skips a new fetch.
          if (lastFetch.current !== fetch) return;
          setState((prev) =>
            prev.owner === owner && sameStatus(prev.map, next) ? prev : { owner, map: next },
          );
        })
        .catch(() => {})
        .finally(() => { fetch.running = false; });
    };
    const start = () => {
      if (interval !== null) return;
      const last = lastFetch.current;
      const fresh = last !== null && last.owner === owner && Date.now() - last.at < GIT_STATUS_MIN_GAP;
      if (!fresh) refresh();
      interval = setInterval(refresh, GIT_STATUS_INTERVAL);
    };
    const stop = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sessionId, defaultPath, owner, active]);

  return state.owner === owner ? state.map : EMPTY;
}
