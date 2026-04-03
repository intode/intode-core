import type { GitStatusMap } from './FileTree';

const GIT_COLORS: Record<string, string> = {
  M: '#e2c08d',   // Modified — warm orange
  A: '#73c991',   // Added/Staged — green
  D: '#c74e39',   // Deleted — red
  '?': '#73c991', // Untracked — green (new file)
  '!': '#9e9e9e', // Ignored — gray
  R: '#73c991',   // Renamed — green
  C: '#73c991',   // Copied — green
};

const GIT_LABELS: Record<string, string> = {
  M: 'M', A: 'A', D: 'D', '?': 'U', '!': 'I', R: 'R', C: 'C',
};

function parseGitKey(status: string): string {
  const s = status.trim();
  if (s === '!!') return '!';
  if (s === '??') return '?';
  return s.charAt(0) === ' ' ? s.charAt(1) : s.charAt(0);
}

const IGNORED_INFO = { label: 'I', color: GIT_COLORS['!'] };

/** Check if any ancestor directory is ignored */
function isUnderIgnoredDir(nodePath: string, gitStatus: GitStatusMap): boolean {
  for (const [filePath, status] of gitStatus) {
    if (status.trim() !== '!!') continue;
    const fp = filePath.replace(/\/$/, '');
    if (nodePath.includes('/' + fp + '/') || nodePath.endsWith('/' + fp)) return true;
  }
  return false;
}

/** Get git status for a file/folder. Folders inherit from children. */
export function getNodeGitInfo(nodePath: string, nodeName: string, isDir: boolean, gitStatus?: GitStatusMap): { label: string; color: string } | null {
  if (!gitStatus || gitStatus.size === 0) return null;

  for (const [filePath, status] of gitStatus) {
    const fp = filePath.replace(/\/$/, '');
    if (nodePath.endsWith('/' + fp) || nodePath === fp || fp === nodeName) {
      const key = parseGitKey(status);
      return { label: GIT_LABELS[key] ?? key, color: GIT_COLORS[key] ?? '#9e9e9e' };
    }
  }

  if (isUnderIgnoredDir(nodePath, gitStatus)) return IGNORED_INFO;

  if (isDir) {
    const dirSuffix = '/' + nodeName + '/';
    for (const [filePath, status] of gitStatus) {
      if (status.trim() === '!!') continue;
      if (filePath.includes(dirSuffix) || filePath.startsWith(nodeName + '/')) {
        return { label: '\u25CF', color: '#e2c08d' };
      }
    }
  }

  return null;
}
