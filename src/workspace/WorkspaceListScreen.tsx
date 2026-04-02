import React, { useState, useEffect } from 'react';
import { Workspace, getWorkspaceStore } from './WorkspaceManager';
import { LONG_PRESS_DELAY_MS } from '../lib/constants';
import { CENTER_COLUMN, BUTTON_PRIMARY, TRUNCATE, NO_TAP_HIGHLIGHT, OVERLAY } from '../lib/styles';

export interface WorkspaceListScreenProps {
  onSelectWorkspace: (workspace: Workspace) => void;
  onAddWorkspace: () => void;
  onEditWorkspace?: (workspace: Workspace) => void;
  onSettings?: () => void;
}

export function WorkspaceListScreen({ onSelectWorkspace, onAddWorkspace, onEditWorkspace, onSettings }: WorkspaceListScreenProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuTarget, setMenuTarget] = useState<Workspace | null>(null);

  const reload = () => {
    getWorkspaceStore().getAll().then((ws) => {
      setWorkspaces(ws);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleDelete = async (ws: Workspace) => {
    await getWorkspaceStore().delete(ws.id);
    setMenuTarget(null);
    reload();
  };

  if (loading) {
    return <div style={styles.center}><span style={{ color: 'var(--text-muted)' }}>Loading...</span></div>;
  }

  if (workspaces.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>{'>'}_</div>
          <p style={styles.emptyText}>Add a workspace to</p>
          <p style={styles.emptyText}>connect to a server</p>
          <button onClick={onAddWorkspace} style={styles.ctaButton}>
            + Add Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Workspaces</span>
        <button onClick={onSettings} style={styles.settingsBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
      <div style={styles.list}>
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            onClick={() => onSelectWorkspace(ws)}
            onContextMenu={(e) => { e.preventDefault(); setMenuTarget(ws); }}
            onPointerDown={(e) => {
              const timer = setTimeout(() => setMenuTarget(ws), LONG_PRESS_DELAY_MS);
              const up = () => { clearTimeout(timer); window.removeEventListener('pointerup', up); };
              window.addEventListener('pointerup', up);
            }}
            style={styles.card}
          >
            <div style={styles.cardDot} />
            <div style={styles.cardInfo}>
              <span style={styles.cardName}>{ws.name}</span>
              <span style={styles.cardHost}>{ws.host}:{ws.port}</span>
              <span style={styles.cardPath}>{ws.defaultPath}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {menuTarget && (
        <div style={styles.overlay} onClick={() => setMenuTarget(null)}>
          <div style={styles.menu} onClick={(e) => e.stopPropagation()}>
            <p style={styles.menuTitle}>{menuTarget.name}</p>
            <button
              style={styles.menuItem}
              onClick={() => { setMenuTarget(null); onEditWorkspace?.(menuTarget); }}
            >
              Edit
            </button>
            <button
              style={{ ...styles.menuItem, color: 'var(--accent-red)' }}
              onClick={() => handleDelete(menuTarget)}
            >
              Delete
            </button>
            <button
              style={styles.menuItem}
              onClick={() => setMenuTarget(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button onClick={onAddWorkspace} style={styles.fab}>+</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', backgroundColor: 'var(--bg-base)', position: 'relative', display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  header: { padding: '16px 20px', borderBottom: '1px solid var(--bg-surface0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.3 },
  settingsBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 },
  list: { overflowY: 'auto', padding: '12px 16px', flex: 1 },
  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', marginBottom: 8,
    backgroundColor: 'var(--bg-surface0)', borderRadius: 12, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background-color var(--transition)',
  },
  cardDot: {
    width: 8, height: 8, borderRadius: '50%',
    backgroundColor: 'var(--accent-blue)', flexShrink: 0, opacity: 0.6,
  },
  cardInfo: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.2 },
  cardHost: { fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' },
  cardPath: { fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: 'monospace' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 },
  emptyIcon: { fontSize: 48, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 16 },
  emptyText: { fontSize: 14, color: 'var(--text-muted)', margin: 0 },
  ctaButton: {
    marginTop: 20, padding: '12px 24px',
    backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: '50%',
    backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', fontSize: 24, fontWeight: 300, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(137, 180, 250, 0.25)',
  },
  overlay: OVERLAY,
  menu: {
    backgroundColor: 'var(--bg-surface0)', borderRadius: 12,
    padding: '16px 0', minWidth: 250, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  menuTitle: {
    fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
    padding: '0 20px 12px', borderBottom: '1px solid var(--bg-surface1)', margin: 0,
  },
  menuItem: {
    display: 'block', width: '100%', padding: '14px 20px',
    background: 'none', border: 'none', textAlign: 'left' as const,
    color: 'var(--text-primary)', fontSize: 15, cursor: 'pointer',
  },
};
