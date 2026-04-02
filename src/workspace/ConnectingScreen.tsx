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
        const connectOpts: import('../ssh/plugin-api').ConnectOptions = {
          host: workspace.host,
          port: workspace.port,
          username: workspace.username,
        };

        if (workspace.authType === 'key' && workspace.keyId) {
          connectOpts.keyId = workspace.keyId;
        } else {
          const password = await getWorkspaceStore().getPassword(workspace.id);
          if (cancelled) return;
          connectOpts.password = password ?? undefined;
        }

        const { sessionId } = await Ssh.connect(connectOpts);

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
      <p style={styles.connectingText}>ACCESSING_SERVER<span className="blink">...</span></p>
      <p style={styles.hostText}>{workspace.host.toUpperCase()} // PORT_{workspace.port}</p>
      <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', backgroundColor: 'var(--bg-base)', gap: 12, padding: 24,
  },
  spinner: { fontSize: 48, color: 'var(--accent-green)', textShadow: 'var(--neon-glow)', animation: 'spin 1s linear infinite', marginBottom: 16 },
  connectingText: { fontSize: 13, color: 'var(--accent-green)', fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, letterSpacing: 1 },
  hostText: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' },
  cancelBtn: { marginTop: 24, background: 'none', border: '1px solid var(--text-muted)', borderRadius: 2, padding: '8px 24px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, cursor: 'pointer', letterSpacing: 1 },
  errorIcon: { fontSize: 40, color: 'var(--accent-red)', fontWeight: 700, textShadow: '0 0 10px rgba(255, 51, 0, 0.4)' },
  errorTitle: { fontSize: 14, color: 'var(--accent-red)', fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, letterSpacing: 1 },
  errorMsg: { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all', maxWidth: '80%', fontFamily: 'IBM Plex Mono' },
  buttonRow: { display: 'flex', gap: 12, marginTop: 24 },
  secondaryBtn: { background: 'none', border: '1px solid var(--text-muted)', borderRadius: 2, padding: '10px 20px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, cursor: 'pointer', letterSpacing: 1 },
  primaryBtn: { backgroundColor: 'transparent', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: 2, padding: '10px 20px', fontSize: 11, fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, cursor: 'pointer', letterSpacing: 1, boxShadow: 'var(--neon-glow)' },
};
