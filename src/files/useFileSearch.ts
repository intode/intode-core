import { useState, useEffect, useMemo } from 'react';
import { Ssh } from '../ssh/index';
import type { FileTreeNode } from './FileTree';

export interface GrepResult {
  path: string;
  name: string;
  line: number;
  text: string;
}

/** Expand ~ to $HOME for use in shell commands */
function shellPath(p: string): string {
  if (p === '~') return '$HOME';
  if (p.startsWith('~/')) return '$HOME' + p.slice(1);
  return p.replace(/'/g, "'\\''");
}

function collectAll(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...collectAll(node.children));
  }
  return result;
}

function fuzzyMatch(name: string, query: string): { match: boolean; score: number } {
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  let score = 0;
  let prevMatch = -1;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      score += (i === prevMatch + 1) ? 2 : 1;
      if (i === 0 || name[i - 1] === '/' || name[i - 1] === '.' || name[i - 1] === '_' || name[i - 1] === '-') {
        score += 3;
      }
      prevMatch = i;
      qi++;
    }
  }
  return { match: qi === q.length, score };
}

export interface FileSearchState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  nameResults: FileTreeNode[];
  grepResults: GrepResult[];
  searching: boolean;
  clearSearch: () => void;
}

export function useFileSearch(nodes: FileTreeNode[], sessionId: string | undefined, rootPath: string): FileSearchState {
  const [searchQuery, setSearchQuery] = useState('');
  const [nameResults, setNameResults] = useState<FileTreeNode[]>([]);
  const [grepResults, setGrepResults] = useState<GrepResult[]>([]);
  const [searching, setSearching] = useState(false);

  const localResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const all = collectAll(nodes);
    return all
      .map((f) => ({ node: f, ...fuzzyMatch(f.name, searchQuery.trim()) }))
      .filter((r) => r.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.node);
  }, [nodes, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim() || !sessionId) {
      setNameResults([]);
      setGrepResults([]);
      return;
    }

    setSearching(true);
    const q = searchQuery.trim().replace(/['"\\]/g, '');
    const sp = shellPath(rootPath);

    const findPromise = Ssh.exec({
      sessionId,
      command: `find ${sp} -maxdepth 5 -iname "*${q}*" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20`,
      timeout: 8000,
    }).then(({ stdout }) => {
      const paths = stdout.trim().split('\n').filter(Boolean);
      return paths.map((p) => ({
        name: p.split('/').pop() ?? p, path: p,
        isDirectory: !p.includes('.') || p.endsWith('/'), size: 0, modifiedAt: 0,
      }));
    }).catch(() => [] as FileTreeNode[]);

    const grepPromise = Ssh.exec({
      sessionId,
      command: `grep -rn -I --color=never --exclude-dir=node_modules --exclude-dir=.git '${q}' ${sp} 2>/dev/null | head -50`,
      timeout: 15000,
    }).then(({ stdout }) => {
      const lines = stdout.trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        const m = line.match(/^(.+?):(\d+):(.*)$/);
        if (!m) return null;
        return { path: m[1], name: m[1].split('/').pop() ?? m[1], line: parseInt(m[2]), text: m[3].trim() };
      }).filter(Boolean) as GrepResult[];
    }).catch(() => [] as GrepResult[]);

    Promise.all([findPromise, grepPromise]).then(([findRes, grepRes]) => {
      const seen = new Set(localResults.map((n) => n.path));
      const merged = [...localResults];
      for (const n of findRes) { if (!seen.has(n.path)) { merged.push(n); seen.add(n.path); } }
      setNameResults(merged.slice(0, 20));
      setGrepResults(grepRes);
      setSearching(false);
    });
  }, [searchQuery, sessionId, localResults, rootPath]);

  const clearSearch = () => {
    setSearchQuery('');
    setNameResults([]);
    setGrepResults([]);
  };

  return { searchQuery, setSearchQuery, nameResults, grepResults, searching, clearSearch };
}
