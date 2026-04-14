import React, { useState, useEffect } from 'react';
import { Workspace, getWorkspaceStore } from './WorkspaceManager';
import { useLongPressMenu } from './useLongPressMenu';
import { WorkspaceContextMenu } from './WorkspaceContextMenu';

export interface WorkspaceListScreenProps {
  onSelectWorkspace: (workspace: Workspace) => void;
  onAddWorkspace: () => void;
  onEditWorkspace?: (workspace: Workspace) => void;
  onDeleteWorkspace?: (workspace: Workspace) => Promise<void>;
  onSettings?: () => void;
  connectedIds?: Set<string>;
}

export function WorkspaceListScreen({ onSelectWorkspace, onAddWorkspace, onEditWorkspace, onDeleteWorkspace, onSettings, connectedIds }: WorkspaceListScreenProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const { target: menuTarget, setTarget: setMenuTarget, bind, shouldSuppressClick } = useLongPressMenu<Workspace>();

  const reload = () => {
    getWorkspaceStore().getAll().then((ws) => {
      setWorkspaces(ws);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleDelete = async (ws: Workspace) => {
    setMenuTarget(null);
    if (onDeleteWorkspace) {
      await onDeleteWorkspace(ws);
      // App-level handler bumps listKey, remounting this screen — no manual reload needed.
    } else {
      await getWorkspaceStore().delete(ws.id);
      reload();
    }
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
        <span style={styles.title}>SYS.WORKSPACES<span className="blink">_</span></span>
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
            {...bind(ws)}
            onClick={() => { if (shouldSuppressClick()) return; onSelectWorkspace(ws); }}
            style={styles.card}
          >
            {connectedIds?.has(ws.id) && <div style={styles.cardDot} />}
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
        <WorkspaceContextMenu
          workspace={menuTarget}
          onEdit={() => { const t = menuTarget; setMenuTarget(null); onEditWorkspace?.(t); }}
          onDelete={() => handleDelete(menuTarget)}
          onCancel={() => setMenuTarget(null)}
          zIndex={150}
        />
      )}

      <button onClick={onAddWorkspace} style={styles.fab}>+</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', backgroundColor: 'var(--bg-base)', position: 'relative', display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  header: { padding: '16px 20px', borderBottom: '1px solid var(--bg-surface0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 700, fontFamily: 'Chakra Petch', color: 'var(--accent-green)', letterSpacing: 1, textShadow: 'var(--neon-glow)' },
  settingsBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 },
  list: { overflowY: 'auto', padding: '12px 16px', flex: 1 },
  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', marginBottom: 8,
    backgroundColor: 'var(--bg-mantle)',
    border: '1px solid var(--bg-surface0)',
    borderRadius: 2,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color var(--transition)',
  },
  cardDot: {
    width: 8, height: 8, borderRadius: '50%',
    backgroundColor: 'var(--accent-green)', flexShrink: 0,
  },
  cardInfo: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  cardName: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.5, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const },
  cardHost: { fontSize: 11, color: 'var(--accent-green)', fontFamily: 'IBM Plex Mono', opacity: 0.8 },
  cardPath: { fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: 'IBM Plex Mono' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 },
  emptyIcon: { fontSize: 48, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 16 },
  emptyText: { fontSize: 14, color: 'var(--text-muted)', margin: 0 },
  ctaButton: {
    marginTop: 20, padding: '12px 24px',
    backgroundColor: 'transparent', color: 'var(--accent-green)',
    border: '1px solid var(--accent-green)', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const,
  },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 2,
    backgroundColor: 'var(--accent-green)', color: 'var(--bg-base)',
    border: 'none', fontSize: 24, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: 'var(--neon-glow)',
  },
};
