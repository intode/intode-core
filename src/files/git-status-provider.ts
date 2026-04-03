/** DI hook for git status — Pro injects a provider at bootstrap */

import type { GitStatusMap } from './FileTree';

type GitStatusProvider = (sessionId: string, rootPath: string) => Promise<GitStatusMap>;

let provider: GitStatusProvider | null = null;

export function setGitStatusProvider(fn: GitStatusProvider): void {
  provider = fn;
}

export function getGitStatusProvider(): GitStatusProvider | null {
  return provider;
}
