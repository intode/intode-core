import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Ssh, SftpEntry } from '../ssh/index';
import { INPUT_FIELD } from '../lib/styles';
import { getNodeGitInfo } from './git-status-utils';
import { useFileSearch } from './useFileSearch';
import type { GrepResult } from './useFileSearch';
import { FileChangeDetector } from './file-change-detector';
import { FileActionSheet } from './FileActionSheet';
import { getTransferManager } from './transfer-singleton';
import { ConflictDialog, type ConflictChoice } from './ConflictDialog';
import { RenameDialog } from './RenameDialog';

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

function abbreviateHome(path: string): string {
  const m = path.match(/^\/home\/([^/]+)(\/.*)?$/);
  if (m) return '~' + (m[2] ?? '');
  if (path.startsWith('/root')) return '~' + path.slice(5);
  return path;
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
  node, depth, onToggle, onFileSelect, onLongPress, gitStatus,
}: {
  node: FileTreeNode; depth: number;
  onToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
  onLongPress: (node: FileTreeNode) => void;
  gitStatus?: GitStatusMap;
}) {
  const pressTimer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    return () => {
      if (pressTimer.current !== null) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startPos.current = { x: t.clientX, y: t.clientY };
    triggered.current = false;
    pressTimer.current = window.setTimeout(() => {
      triggered.current = true;
      try { navigator.vibrate?.(10); } catch {}
      onLongPress(node);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startPos.current || pressTimer.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - startPos.current.x;
    const dy = t.clientY - startPos.current.y;
    if (Math.hypot(dx, dy) > 10) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer.current !== null) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handleClick = () => {
    if (triggered.current) return;
    if (node.isDirectory) onToggle(node.path);
    else onFileSelect(node.path);
  };

  const badge = getNodeGitInfo(node.path, node.name, node.isDirectory, gitStatus);
  const isIgnored = badge?.label === 'I';
  const nameColor = isIgnored ? '#4a4f54' : badge ? badge.color : undefined;

  return (
    <>
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ ...styles.item, paddingLeft: 12 + depth * 16, opacity: isIgnored ? 0.8 : 1 }}
      >
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
        <FileTreeItem key={child.path} node={child} depth={depth + 1} onToggle={onToggle} onFileSelect={onFileSelect} onLongPress={onLongPress} gitStatus={gitStatus} />
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
  const [actionTarget, setActionTarget] = useState<FileTreeNode | null>(null);
  const [clipboard, setClipboard] = useState<{ op: 'copy' | 'move'; path: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileTreeNode | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    remoteDir: string;
    items: import('../ssh/plugin-api').SftpUploadItem[];
    totalBytes: number;
    conflicts: string[];
  } | null>(null);
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

  // Refresh a specific folder's children (or the root if path === rootPath).
  // Preserves expansion state for existing child folders.
  const refreshFolder = useCallback(async (path: string) => {
    if (!sftpId) return;
    try {
      const { entries } = await Ssh.sftpLs({ sftpId, path });
      const freshChildren = sortEntries(entries).map(toNode);
      // Invalidate detector so subsequent visibility checks see the new state.
      try { detectorRef.current.invalidate(path); } catch {}
      setNodes((prev) => updateTreeAt(prev, path, rootPath, freshChildren));
    } catch { /* folder may have been deleted */ }
  }, [sftpId, rootPath]);

  const handleRename = useCallback(async (newName: string) => {
    const target = renameTarget;
    setRenameTarget(null);
    if (!target) return;
    const parent = target.path.substring(0, target.path.lastIndexOf('/')) || rootPath;
    const newPath = `${parent}/${newName}`;
    try {
      await Ssh.sftpRename({ sftpId, oldPath: target.path, newPath });
      void refreshFolder(parent);
    } catch (e: unknown) {
      alert(`Rename failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [renameTarget, sftpId, rootPath, refreshFolder]);

  const handlePaste = useCallback(async (destDir: string) => {
    const cb = clipboard;
    if (!cb) return;
    const destPath = `${destDir.replace(/\/$/, '')}/${cb.name}`;
    try {
      if (cb.op === 'move') {
        await Ssh.sftpRename({ sftpId, oldPath: cb.path, newPath: destPath });
      } else {
        await Ssh.sftpCopy({ sftpId, sourcePath: cb.path, destPath });
      }
      setClipboard(null);
      const srcParent = cb.path.substring(0, cb.path.lastIndexOf('/')) || rootPath;
      void refreshFolder(destDir);
      if (cb.op === 'move' && srcParent !== destDir) void refreshFolder(srcParent);
    } catch (e: unknown) {
      alert(`Paste failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [clipboard, sftpId, rootPath, refreshFolder]);

  // Auto-refresh when an upload finishes. Uses remoteDir on TransferState.
  useEffect(() => {
    const mgr = getTransferManager();
    const prevPhases = new Map<string, string>();
    return mgr.subscribe((states) => {
      for (const s of states) {
        const prev = prevPhases.get(s.id);
        if (prev !== 'done' && s.phase === 'done' && s.kind === 'upload' && s.remoteDir) {
          void refreshFolder(s.remoteDir);
        }
        prevPhases.set(s.id, s.phase);
      }
    });
  }, [refreshFolder]);

  const handleDownload = useCallback(async (node: FileTreeNode) => {
    const result = await Ssh.sftpPickSaveLocation({ suggestedName: node.name });
    if (result.cancelled || !result.localUri) return;
    getTransferManager().startDownload({
      sftpId,
      remotePath: node.path,
      localUri: result.localUri,
      label: node.name,
    });
  }, [sftpId]);

  const submitUpload = useCallback(async (
    remoteDir: string,
    result: import('../ssh/plugin-api').SftpPickResult,
  ) => {
    if (result.cancelled || result.items.length === 0) return;

    const remotePaths = result.items
      .filter((it) => !it.isDirectory)
      .map((it) => `${remoteDir.replace(/\/$/, '')}/${it.remoteRelativePath}`);
    const { existing } = await Ssh.sftpCheckRemoteExists({ sftpId, paths: remotePaths });

    if (existing.length === 0) {
      const fileCount = remotePaths.length;
      getTransferManager().startUpload({
        sftpId,
        remoteDir,
        items: result.items,
        totalBytes: result.totalBytes,
        onConflict: 'overwrite',
        label: `${remoteDir.split('/').pop() || '/'} (${fileCount} files)`,
      });
      return;
    }

    setPendingUpload({ remoteDir, items: result.items, totalBytes: result.totalBytes, conflicts: existing });
  }, [sftpId]);

  const handleUploadFiles = useCallback(async (remoteDir: string) => {
    const result = await Ssh.sftpPickFilesToUpload({ allowMultiple: true });
    await submitUpload(remoteDir, result);
  }, [submitUpload]);

  const handleUploadFolder = useCallback(async (remoteDir: string) => {
    const result = await Ssh.sftpPickFolderToUpload();
    await submitUpload(remoteDir, result);
  }, [submitUpload]);

  const finishConflict = useCallback((choice: ConflictChoice) => {
    const p = pendingUpload;
    setPendingUpload(null);
    if (!p || choice === 'cancel') return;
    const onConflict = choice === 'overwrite' ? 'overwrite' : choice === 'rename' ? 'rename' : 'skip';
    const fileCount = p.items.filter((it) => !it.isDirectory).length;
    getTransferManager().startUpload({
      sftpId,
      remoteDir: p.remoteDir,
      items: p.items,
      totalBytes: p.totalBytes,
      onConflict,
      label: `${p.remoteDir.split('/').pop() || '/'} (${fileCount} files)`,
    });
  }, [pendingUpload, sftpId]);

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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', height: 28,
        borderBottom: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)', fontSize: 11,
        fontFamily: 'var(--font-mono, monospace)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {abbreviateHome(rootPath)}
        </div>
        <button
          onClick={() => setActionTarget({
            name: abbreviateHome(rootPath),
            path: rootPath,
            isDirectory: true,
            size: 0,
            modifiedAt: 0,
          })}
          aria-label="Upload to root"
          style={{ background: 'transparent', border: 'none', padding: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      {clipboard && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            fontSize: 11,
            background: 'var(--accent-yellow-dim, #3a2e00)',
            color: 'var(--accent-yellow, #ffcc00)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clipboard.op === 'copy' ? 'Copy' : 'Move'}: {clipboard.name}
          </span>
          <button
            onClick={() => setClipboard(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 11 }}
          >
            Clear
          </button>
        </div>
      )}
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
            <FileTreeItem key={node.path} node={node} depth={0} onToggle={handleToggle} onFileSelect={onFileSelect} onLongPress={setActionTarget} gitStatus={gitStatus} />
          ))}
        </div>
      )}
      <FileActionSheet
        target={actionTarget ? {
          kind: actionTarget.isDirectory ? 'folder' : 'file',
          name: actionTarget.name,
          path: actionTarget.path,
        } : null}
        clipboardHasContent={!!clipboard}
        onClose={() => setActionTarget(null)}
        onAction={(action) => {
          if (!actionTarget) return;
          if (action === 'download' && !actionTarget.isDirectory) {
            void handleDownload(actionTarget);
          } else if (action === 'uploadFiles' && actionTarget.isDirectory) {
            void handleUploadFiles(actionTarget.path);
          } else if (action === 'uploadFolder' && actionTarget.isDirectory) {
            void handleUploadFolder(actionTarget.path);
          } else if (action === 'rename') {
            setRenameTarget(actionTarget);
          } else if (action === 'copy') {
            setClipboard({ op: 'copy', path: actionTarget.path, name: actionTarget.name });
          } else if (action === 'move') {
            setClipboard({ op: 'move', path: actionTarget.path, name: actionTarget.name });
          } else if (action === 'pasteHere' && actionTarget.isDirectory) {
            void handlePaste(actionTarget.path);
          }
        }}
      />
      {renameTarget && (
        <RenameDialog
          initialName={renameTarget.name}
          title={renameTarget.isDirectory ? 'Rename folder' : 'Rename file'}
          onSubmit={(newName) => void handleRename(newName)}
          onCancel={() => setRenameTarget(null)}
        />
      )}
      {pendingUpload && (
        <ConflictDialog
          conflictCount={pendingUpload.conflicts.length}
          totalCount={pendingUpload.items.filter(i => !i.isDirectory).length}
          onChoose={finishConflict}
        />
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

function sortNodeList(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

// Replace the children at `targetPath` with `newChildren`, preserving expansion
// state of matching existing subfolders. When targetPath === rootPath, the
// replacement happens at the top level.
function updateTreeAt(
  nodes: FileTreeNode[],
  targetPath: string,
  rootPath: string,
  newChildren: FileTreeNode[],
): FileTreeNode[] {
  if (targetPath === rootPath) {
    const prevMap = new Map<string, FileTreeNode>();
    const collect = (ns: FileTreeNode[]) => {
      for (const n of ns) {
        prevMap.set(n.path, n);
        if (n.children) collect(n.children);
      }
    };
    collect(nodes);
    return sortNodeList(
      newChildren.map((c) => {
        const prev = prevMap.get(c.path);
        return {
          ...c,
          isExpanded: prev?.isExpanded ?? false,
          children: prev?.children,
        };
      }),
    );
  }
  return nodes.map((n) => {
    if (n.path === targetPath) {
      // Preserve expansion state of any child folders that still exist.
      const prevChildMap = new Map<string, FileTreeNode>();
      if (n.children) for (const c of n.children) prevChildMap.set(c.path, c);
      const merged = newChildren.map((c) => {
        const prev = prevChildMap.get(c.path);
        return {
          ...c,
          isExpanded: prev?.isExpanded ?? false,
          children: prev?.children,
        };
      });
      return { ...n, children: sortNodeList(merged), isExpanded: true };
    }
    if (n.children) {
      return { ...n, children: updateTreeAt(n.children, targetPath, rootPath, newChildren) };
    }
    return n;
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
