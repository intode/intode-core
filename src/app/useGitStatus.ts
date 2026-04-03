import { useState, useEffect } from 'react';
import { getGitStatusProvider } from '../files/git-status-provider';
import type { GitStatusMap } from '../files/FileTree';

const GIT_STATUS_INTERVAL = 30_000;

export function useGitStatus(sessionId: string | undefined, defaultPath: string | undefined): GitStatusMap {
  const [gitStatusMap, setGitStatusMap] = useState<GitStatusMap>(new Map());

  useEffect(() => {
    const provider = getGitStatusProvider();
    if (!provider || !sessionId || !defaultPath) {
      setGitStatusMap(new Map());
      return;
    }
    let cancelled = false;
    const refresh = () => {
      provider(sessionId, defaultPath).then((m) => {
        if (!cancelled) setGitStatusMap(m);
      }).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, GIT_STATUS_INTERVAL);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, defaultPath]);

  return gitStatusMap;
}
