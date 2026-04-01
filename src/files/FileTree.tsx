import React, { useState, useEffect, useCallback } from 'react';
import { Ssh, SftpEntry } from '../ssh/index';

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
  node,
  depth,
  onToggle,
  onFileSelect,
}: {
  node: FileTreeNode;
  depth: number;
  onToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
}) {
  const handleTap = () => {
    if (node.isDirectory) {
      onToggle(node.path);
    } else {
      onFileSelect(node.path);
    }
  };

  return (
    <>
      <div
        onClick={handleTap}
        style={{
          ...styles.item,
          paddingLeft: 12 + depth * 16,
        }}
      >
        <span style={styles.icon}>
          {node.isDirectory ? (node.isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span style={styles.name}>{node.name}</span>
        {node.isLoading && <span style={styles.spinner}>⟳</span>}
      </div>
      {node.isExpanded && node.children?.map((child) => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          onToggle={onToggle}
          onFileSelect={onFileSelect}
        />
      ))}
    </>
  );
}

export function FileTree({ sftpId, rootPath, onFileSelect }: FileTreeProps) {
  const [nodes, setNodes] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sftpId) return;
    setLoading(true);
    Ssh.sftpLs({ sftpId, path: rootPath }).then(({ entries }) => {
      setNodes(sortEntries(entries).map(toNode));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sftpId, rootPath]);

  const handleToggle = useCallback(async (path: string) => {
    setNodes((prev) => updateNode(prev, path, (node) => {
      if (node.isExpanded) {
        return { ...node, isExpanded: false };
      }
      if (node.children !== undefined) {
        return { ...node, isExpanded: true };
      }
      return { ...node, isLoading: true, isExpanded: true };
    }));

    // Lazy load children
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

  if (loading) {
    return <div style={styles.center}><span style={{ color: 'var(--text-muted)' }}>Loading...</span></div>;
  }

  if (nodes.length === 0) {
    return <div style={styles.center}><span style={{ color: 'var(--text-muted)' }}>Empty directory</span></div>;
  }

  return (
    <div style={styles.container}>
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          onToggle={handleToggle}
          onFileSelect={onFileSelect}
        />
      ))}
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
    if (node.children) {
      return { ...node, children: updateNode(node.children, path, updater) };
    }
    return node;
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
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
    fontSize: 14,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    height: '100%',
  },
};
