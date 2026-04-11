import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Ssh, SftpEntry } from '../ssh/index';
import { INPUT_FIELD } from '../lib/styles';
import { getNodeGitInfo } from './git-status-utils';
import { useFileSearch } from './useFileSearch';
import type { GrepResult } from './useFileSearch';
import { FileChangeDetector } from './file-change-detector';

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

/** Git status per file path — injected from Pro */
export type GitStatusMap = Map<string, string>;

export interface FileTreeProps {
  sftpId: string;
  rootPath: string;
  onFileSelect: (path: string) => void;
  sessionId?: string;
  gitStatus?: GitStatusMap;
  initialExpandedFolders?: string[];
  onExpandChange?: (expandedFolders: string[]) => void;
  visible?: boolean;
}

function collectExpandedFolders(nodes: FileTreeNode[]): string[] {
  const result: string[] = [];
  const walk = (list: FileTreeNode[]) => {
    for (const n of list) {
      if (n.isDirectory && n.isExpanded) {
        result.push(n.path);
        if (n.children) walk(n.children);
      }
    }
  };
  walk(nodes);
  return result;
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


function FileTreeItem({
  node, depth, onToggle, onFileSelect, gitStatus,
}: {
  node: FileTreeNode; depth: number;
  onToggle: (path: string) => void; onFileSelect: (path: string) => void;
  gitStatus?: GitStatusMap;
}) {
  const handleTap = () => {
    if (node.isDirectory) onToggle(node.path);
    else onFileSelect(node.path);
  };

  const badge = getNodeGitInfo(node.path, node.name, node.isDirectory, gitStatus);
  const isIgnored = badge?.label === 'I';
  const nameColor = isIgnored ? '#4a4f54' : badge ? badge.color : undefined;

  return (
    <>
      <div onClick={handleTap} style={{ ...styles.item, paddingLeft: 12 + depth * 16, opacity: isIgnored ? 0.8 : 1 }}>
        <span style={styles.icon}>
          {node.isDirectory ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: isIgnored ? '#4a4f54' : node.isExpanded ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill={node.isExpanded ? 'rgba(0,255,102,0.1)' : 'none'} />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: isIgnored ? '#4a4f54' : 'var(--text-tertiary)' }}>
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M13 2v7h7" />
            </svg>
          )}
        </span>
        <span style={{ ...styles.name, color: nameColor ?? 'var(--text-primary)' }}>{node.name}</span>
        {badge && !isIgnored && <span style={{ ...styles.gitBadge, color: badge.color }}>{badge.label}</span>}
        {node.isLoading && <span style={styles.spinner}>{'\u27F3'}</span>}
      </div>
      {node.isExpanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} onToggle={onToggle} onFileSelect={onFileSelect} gitStatus={gitStatus} />
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

export function FileTree({ sftpId, rootPath, onFileSelect, sessionId, gitStatus, initialExpandedFolders, onExpandChange, visible }: FileTreeProps) {
  const [nodes, setNodes] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const expandQueueRef = React.useRef<string[]>(initialExpandedFolders ?? []);
  const { searchQuery, setSearchQuery, nameResults, grepResults, searching, clearSearch } = useFileSearch(nodes, sessionId, rootPath);

  useEffect(() => {
    if (!sftpId) return;
    setLoading(true);
    Ssh.sftpLs({ sftpId, path: rootPath }).then(async ({ entries }) => {
      setNodes(sortEntries(entries).map(toNode));
      setLoading(false);
      // Restore expanded folders from saved state
      const queue = expandQueueRef.current;
      expandQueueRef.current = [];
      // Sort by depth (shallow first) to expand parent before child
      queue.sort((a, b) => a.split('/').length - b.split('/').length);
      for (const folderPath of queue) {
        try {
          const { entries: childEntries } = await Ssh.sftpLs({ sftpId, path: folderPath });
          const children = sortEntries(childEntries).map(toNode);
          setNodes((prev) => updateNode(prev, folderPath, (node) => ({ ...node, children, isExpanded: true, isLoading: false })));
        } catch { /* folder may no longer exist */ }
      }
    }).catch(() => setLoading(false));
  }, [sftpId, rootPath]);

  const detectorRef = React.useRef(new FileChangeDetector());

  // Refresh expanded folders on tab visibility change
  useEffect(() => {
    if (!visible || !sftpId || loading) return;

    const detector = detectorRef.current;
    const expandedFolders = collectExpandedFolders(nodes);
    const pathsToCheck = [rootPath, ...expandedFolders];

    let cancelled = false;

    (async () => {
      for (const folderPath of pathsToCheck) {
        if (cancelled) return;
        try {
          const diff = await detector.checkDirectory(sftpId, folderPath);
          if (!diff.changed) continue;

          const children = sortEntries(diff.entries).map(toNode);
          if (folderPath === rootPath) {
            setNodes((prev) => {
              return children.map(child => {
                const existing = prev.find(n => n.path === child.path);
                if (existing && existing.isDirectory && existing.isExpanded) {
                  return { ...child, children: existing.children, isExpanded: true };
                }
                return child;
              });
            });
          } else {
            setNodes((prev) => updateNode(prev, folderPath, (node) => {
              const merged = children.map(child => {
                const existing = node.children?.find(n => n.path === child.path);
                if (existing && existing.isDirectory && existing.isExpanded) {
                  return { ...child, children: existing.children, isExpanded: true };
                }
                return child;
              });
              return { ...node, children: merged };
            }));
          }
        } catch { /* folder may have been deleted */ }
      }
    })();

    return () => { cancelled = true; };
  }, [visible]);

  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const treeScrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (treeScrollRef.current && treeScrollRef.current.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    } else {
      pullStartY.current = 0;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullStartY.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0 && diff < 120) {
      setPullDistance(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance < 60 || !sftpId) {
      setPullDistance(0);
      pullStartY.current = 0;
      return;
    }

    setPullDistance(0);
    pullStartY.current = 0;
    setRefreshing(true);

    const detector = detectorRef.current;
    const expandedFolders = collectExpandedFolders(nodes);
    const pathsToRefresh = [rootPath, ...expandedFolders];

    for (const p of pathsToRefresh) detector.invalidate(p);

    try {
      const { entries } = await Ssh.sftpLs({ sftpId, path: rootPath });
      const rootChildren = sortEntries(entries).map(toNode);

      const expanded = new Map<string, FileTreeNode[]>();
      for (const folderPath of expandedFolders) {
        try {
          const { entries: childEntries } = await Ssh.sftpLs({ sftpId, path: folderPath });
          expanded.set(folderPath, sortEntries(childEntries).map(toNode));
          detector.checkDirectory(sftpId, folderPath).catch(() => {});
        } catch { /* folder deleted */ }
      }

      setNodes(() => {
        const applyExpanded = (list: FileTreeNode[]): FileTreeNode[] =>
          list.map(node => {
            if (node.isDirectory && expanded.has(node.path)) {
              return { ...node, isExpanded: true, children: applyExpanded(expanded.get(node.path)!) };
            }
            return node;
          });
        return applyExpanded(rootChildren);
      });
    } catch { /* ignore */ }

    setRefreshing(false);
  }, [pullDistance, sftpId, nodes, rootPath]);

  const navigateToFolder = useCallback(async (folderPath: string) => {
    clearSearch();
    // Expand the folder
    setNodes((prev) => updateNode(prev, folderPath, (node) => {
      if (!node.isDirectory) return node;
      return { ...node, isExpanded: true, isLoading: node.children === undefined };
    }));
    // Load children if needed
    const target = findNode(nodes, folderPath);
    if (target && target.children === undefined) {
      try {
        const { entries } = await Ssh.sftpLs({ sftpId, path: folderPath });
        const children = sortEntries(entries).map(toNode);
        setNodes((prev) => updateNode(prev, folderPath, (node) => ({ ...node, children, isLoading: false, isExpanded: true })));
      } catch {}
    }
  }, [sftpId, nodes]);

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

  // Notify parent of expand state changes for session persistence
  useEffect(() => {
    if (!loading && onExpandChange) {
      onExpandChange(collectExpandedFolders(nodes));
    }
  }, [nodes, loading]);

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
          <button onClick={clearSearch} style={styles.clearBtn}>{'\u2715'}</button>
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
                  onSelect={() => {
                    if (node.isDirectory) { navigateToFolder(node.path); }
                    else { onFileSelect(node.path); clearSearch(); }
                  }} />
              ))}
            </>
          )}

          {/* Content (grep) matches */}
          {grepResults.length > 0 && (
            <>
              <div style={styles.sectionLabel}>Content Matches</div>
              {grepResults.map((r, i) => (
                <div key={`${r.path}:${r.line}:${i}`} onClick={() => { onFileSelect(r.path); clearSearch(); }} style={styles.item}>
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
        <div
          ref={treeScrollRef}
          style={styles.treeScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {(pullDistance > 0 || refreshing) && (
            <div style={{
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 12,
              color: 'var(--text-muted)',
              transition: 'opacity 150ms',
            }}>
              {refreshing ? '\u27F3 Refreshing...' : pullDistance >= 60 ? '\u2191 Release to refresh' : '\u2193 Pull to refresh'}
            </div>
          )}
          {nodes.map((node) => (
            <FileTreeItem key={node.path} node={node} depth={0} onToggle={handleToggle} onFileSelect={onFileSelect} gitStatus={gitStatus} />
          ))}
        </div>
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
  treeScroll: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
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
  gitBadge: {
    fontSize: 10, fontWeight: 700, fontFamily: 'monospace', marginLeft: 'auto',
    padding: '1px 5px', borderRadius: 3, flexShrink: 0,
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
