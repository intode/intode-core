import React, { useEffect, useState } from 'react';
import { Workspace, getWorkspaceStore } from './WorkspaceManager';
import { Ssh } from '../ssh/index';

export interface ConnectingScreenProps {
  workspace: Workspace;
  onConnected: (sessionId: string) => void;
  onFailed: (error: string) => void;
  onCancel: () => void;
}

export function ConnectingScreen({ workspace, onConnected, onFailed, onCancel }: ConnectingScreenProps) {
  const [status, setStatus] = useState<'connecting' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const password = await getWorkspaceStore().getPassword(workspace.id);
        if (cancelled) return;

        const { sessionId } = await Ssh.connect({
          host: workspace.host,
          port: workspace.port,
          username: workspace.username,
          password: password ?? undefined,
        });

        if (cancelled) return;
        onConnected(sessionId);
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(String(e));
        onFailed(String(e));
      }
    }

    connect();
    return () => { cancelled = true; };
  }, [workspace]);

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.errorIcon}>✕</div>
        <p style={styles.errorTitle}>Connection Failed</p>
        <p style={styles.errorMsg}>{errorMsg}</p>
        <div style={styles.buttonRow}>
          <button onClick={onCancel} style={styles.secondaryBtn}>Go Back</button>
          <button onClick={() => { setStatus('connecting'); setErrorMsg(''); }} style={styles.primaryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.spinner}>⟳</div>
      <p style={styles.connectingText}>Connecting...</p>
      <p style={styles.hostText}>{workspace.host}:{workspace.port}</p>
      <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', backgroundColor: 'var(--bg-base)', gap: 12, padding: 24,
  },
  spinner: { fontSize: 40, color: 'var(--accent-blue)', animation: 'spin 1s linear infinite' },
  connectingText: { fontSize: 16, color: 'var(--text-primary)', fontWeight: 500 },
  hostText: { fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' },
  cancelBtn: { marginTop: 16, background: 'none', border: '1px solid var(--bg-surface1)', borderRadius: 8, padding: '10px 20px', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' },
  errorIcon: { fontSize: 40, color: 'var(--accent-red)', fontWeight: 700 },
  errorTitle: { fontSize: 16, color: 'var(--accent-red)', fontWeight: 600 },
  errorMsg: { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all', maxWidth: '80%' },
  buttonRow: { display: 'flex', gap: 12, marginTop: 16 },
  secondaryBtn: { background: 'none', border: '1px solid var(--bg-surface1)', borderRadius: 8, padding: '12px 20px', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' },
  primaryBtn: { backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
};
