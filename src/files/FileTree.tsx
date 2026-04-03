import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Ssh, SftpEntry } from '../ssh/index';
import { INPUT_FIELD } from '../lib/styles';

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface FileTreeProps {
  sftpId: string;
  rootPath: string;
  onFileSelect: (path: string) => void;
  sessionId?: string;
}

/** Expand ~ to $HOME for use in shell commands (~ doesn't expand inside quotes) */
function shellPath(p: string): string {
  if (p === '~') return '$HOME';
  if (p.startsWith('~/')) return '$HOME' + p.slice(1);
  return p.replace(/'/g, "'\\''");
}

function sortEntries(entries: SftpEntry[]): SftpEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

function toNode(entry: SftpEntry): FileTreeNode {
  return {
    name: entry.name,
    path: entry.path,
    isDirectory: entry.isDirectory,
    size: entry.size,
    modifiedAt: entry.modifiedAt,
    children: entry.isDirectory ? undefined : undefined,
    isExpanded: false,
    isLoading: false,
  };
}

// Collect all entries (files + dirs) from loaded tree
function collectAll(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...collectAll(node.children));
  }
  return result;
}

// Simple fuzzy match: all chars of query appear in order in name
function fuzzyMatch(name: string, query: string): { match: boolean; score: number } {
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  let score = 0;
  let prevMatch = -1;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      score += (i === prevMatch + 1) ? 2 : 1; // consecutive bonus
      if (i === 0 || name[i - 1] === '/' || name[i - 1] === '.' || name[i - 1] === '_' || name[i - 1] === '-') {
        score += 3; // word boundary bonus
      }
      prevMatch = i;
      qi++;
    }
  }
  return { match: qi === q.length, score };
}

function FileTreeItem({
  node, depth, onToggle, onFileSelect,
}: {
  node: FileTreeNode; depth: number;
  onToggle: (path: string) => void; onFileSelect: (path: string) => void;
}) {
  const handleTap = () => {
    if (node.isDirectory) onToggle(node.path);
    else onFileSelect(node.path);
  };

  return (
    <>
      <div onClick={handleTap} style={{ ...styles.item, paddingLeft: 12 + depth * 16 }}>
        <span style={styles.icon}>
          {node.isDirectory ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: node.isExpanded ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill={node.isExpanded ? 'rgba(0,255,102,0.1)' : 'none'} />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-tertiary)' }}>
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M13 2v7h7" />
            </svg>
          )}
        </span>
        <span style={styles.name}>{node.name}</span>
        {node.isLoading && <span style={styles.spinner}>{'\u27F3'}</span>}
      </div>
      {node.isExpanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} onToggle={onToggle} onFileSelect={onFileSelect} />
      ))}
    </>
  );
}

// Search result item (flat list)
function SearchResultItem({ node, rootPath, onSelect }: { node: FileTreeNode; rootPath: string; onSelect: () => void }) {
  const relative = node.path.startsWith(rootPath)
    ? node.path.slice(rootPath.length).replace(/^\//, '')
    : node.path;
  const dir = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : '';

  return (
    <div onClick={onSelect} style={styles.item}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M13 2v7h7" />
      </svg>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={styles.name}>{node.name}</div>
        {dir && <div style={styles.searchDir}>{dir}</div>}
      </div>
    </div>
  );
}

interface GrepResult {
  path: string;
  name: string;
  line: number;
  text: string;
}

export function FileTree({ sftpId, rootPath, onFileSelect, sessionId }: FileTreeProps) {
  const [nodes, setNodes] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nameResults, setNameResults] = useState<FileTreeNode[]>([]);
  const [grepResults, setGrepResults] = useState<GrepResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!sftpId) return;
    setLoading(true);
    Ssh.sftpLs({ sftpId, path: rootPath }).then(({ entries }) => {
      setNodes(sortEntries(entries).map(toNode));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sftpId, rootPath]);

  // Local fuzzy search on cached tree (files + directories)
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

  // Remote search: run find (name+dir) AND grep (content) in parallel
  useEffect(() => {
    if (!searchQuery.trim() || !sessionId) {
      setNameResults([]);
      setGrepResults([]);
      return;
    }

    setSearching(true);
    const q = searchQuery.trim().replace(/['"\\]/g, '');
    const sp = shellPath(rootPath);

    // 1) File/folder name search via find
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

    // 2) Content search via grep
    const grepPromise = Ssh.exec({
      sessionId,
      command: `grep -rn -I '${q}' ${sp} 2>/dev/null | head -50`,
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
      // Merge local + remote name results, deduplicate
      const seen = new Set(localResults.map((n) => n.path));
      const merged = [...localResults];
      for (const n of findRes) { if (!seen.has(n.path)) { merged.push(n); seen.add(n.path); } }
      setNameResults(merged.slice(0, 20));
      setGrepResults(grepRes);
      setSearching(false);
    });
  }, [searchQuery, sessionId, localResults, rootPath]);

  const handleToggle = useCallback(async (path: string) => {
    setNodes((prev) => updateNode(prev, path, (node) => {
      if (node.isExpanded) return { ...node, isExpanded: false };
      if (node.children !== undefined) return { ...node, isExpanded: true };
      return { ...node, isLoading: true, isExpanded: true };
    }));

    const target = findNode(nodes, path);
    if (target && target.children === undefined) {
      try {
        const { entries } = await Ssh.sftpLs({ sftpId, path });
        const children = sortEntries(entries).map(toNode);
        setNodes((prev) => updateNode(prev, path, (node) => ({
          ...node, children, isLoading: false,
        })));
      } catch {
        setNodes((prev) => updateNode(prev, path, (node) => ({
          ...node, children: [], isLoading: false,
        })));
      }
    }
  }, [sftpId, nodes]);

  const isSearching = searchQuery.trim().length > 0;
  const hasResults = nameResults.length > 0 || grepResults.length > 0;

  if (loading) {
    return <div style={styles.center}><span style={{ color: 'var(--text-muted)' }}>Loading...</span></div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files & content..."
          style={styles.searchInput}
          autoComplete="off"
          spellCheck={false}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setGrepResults([]); setNameResults([]); }} style={styles.clearBtn}>{'\u2715'}</button>
        )}
      </div>

      {isSearching ? (
        <div style={styles.resultsList}>
          {searching && <div style={styles.searchHint}>Searching...</div>}
          {!hasResults && !searching && <div style={styles.searchHint}>No results</div>}

          {/* File/folder name matches */}
          {nameResults.length > 0 && (
            <>
              <div style={styles.sectionLabel}>Files & Folders</div>
              {nameResults.map((node) => (
                <SearchResultItem key={node.path} node={node} rootPath={rootPath}
                  onSelect={() => { if (!node.isDirectory) { onFileSelect(node.path); setSearchQuery(''); } }} />
              ))}
            </>
          )}

          {/* Content (grep) matches */}
          {grepResults.length > 0 && (
            <>
              <div style={styles.sectionLabel}>Content Matches</div>
              {grepResults.map((r, i) => (
                <div key={`${r.path}:${r.line}:${i}`} onClick={() => { onFileSelect(r.path); setSearchQuery(''); }} style={styles.item}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{r.name}:{r.line}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : nodes.length === 0 ? (
        <div style={styles.center}><span style={{ color: 'var(--text-muted)' }}>Empty directory</span></div>
      ) : (
        nodes.map((node) => (
          <FileTreeItem key={node.path} node={node} depth={0} onToggle={handleToggle} onFileSelect={onFileSelect} />
        ))
      )}
    </div>
  );
}

function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

function updateNode(
  nodes: FileTreeNode[],
  path: string,
  updater: (node: FileTreeNode) => FileTreeNode,
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === path) return updater(node);
    if (node.children) return { ...node, children: updateNode(node.children, path, updater) };
    return node;
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--bg-surface0)',
    flexShrink: 0,
  },
  sectionLabel: {
    padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)',
    textTransform: 'uppercase' as const, letterSpacing: 1,
  },
  searchInput: {
    ...INPUT_FIELD,
    flex: 1,
    padding: '8px 10px',
    fontSize: 13,
  },
  clearBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    fontSize: 14, cursor: 'pointer', padding: '4px 8px', marginLeft: 4,
  },
  resultsList: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  searchHint: {
    padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)',
  },
  searchDir: {
    fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--bg-surface0)',
    WebkitTapHighlightColor: 'transparent',
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  name: {
    fontSize: 13,
    fontFamily: 'IBM Plex Mono',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: -0.2,
  },
  spinner: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginLeft: 'auto',
    animation: 'spin 1s linear infinite',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    fontSize: 16,
  },
};
