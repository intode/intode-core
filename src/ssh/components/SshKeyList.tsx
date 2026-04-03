import React, { useState, useEffect, useCallback } from 'react';
import { Ssh } from '../index';
import type { SshKey } from '../plugin-api';
import { SshKeyGenerateModal } from './SshKeyGenerateModal';
import { SshKeyImportModal } from './SshKeyImportModal';
import { COPY_FEEDBACK_MS } from '../../lib/constants';

export function SshKeyList() {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Ssh.listSshKeys().then(({ keys: k }) => setKeys(k)).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (key: SshKey) => {
    if (!confirm(`Delete key "${key.name}"?`)) return;
    await Ssh.deleteSshKey({ keyId: key.id });
    refresh();
  };

  const handleCopyPublic = async (key: SshKey) => {
    try {
      await navigator.clipboard.writeText(key.publicKey);
      setCopiedId(key.id);
      setTimeout(() => setCopiedId(null), COPY_FEEDBACK_MS);
    } catch { /* clipboard not available */ }
  };

  const handleGenerated = () => {
    setShowGenerate(false);
    refresh();
  };

  const handleImported = () => {
    setShowImport(false);
    refresh();
  };

  return (
    <div>
      <div style={styles.actions}>
        <button onClick={() => setShowGenerate(true)} style={styles.actionBtn}>Generate Key</button>
        <button onClick={() => setShowImport(true)} style={styles.actionBtn}>Import Key</button>
      </div>

      {keys.length === 0 ? (
        <p style={styles.empty}>No SSH keys stored</p>
      ) : (
        keys.map((key) => (
          <div key={key.id} style={styles.keyCard}>
            <div style={styles.keyHeader}>
              <span style={styles.keyName}>{key.name}</span>
              <span style={styles.keyType}>{key.type.toUpperCase()}</span>
            </div>
            <div style={styles.fingerprint}>{key.fingerprint}</div>
            <div style={styles.keyActions}>
              <button onClick={() => handleCopyPublic(key)} style={styles.smallBtn}>
                {copiedId === key.id ? 'Copied!' : 'Copy Public Key'}
              </button>
              <button onClick={() => handleDelete(key)} style={styles.deleteBtn}>Delete</button>
            </div>
          </div>
        ))
      )}

      {showGenerate && (
        <SshKeyGenerateModal onDone={handleGenerated} onCancel={() => setShowGenerate(false)} />
      )}
      {showImport && (
        <SshKeyImportModal onDone={handleImported} onCancel={() => setShowImport(false)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  actions: { display: 'flex', gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1, padding: '10px', backgroundColor: 'transparent', color: 'var(--accent-blue)',
    border: '1px solid var(--accent-blue)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  empty: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' },
  keyCard: {
    padding: 12, marginBottom: 8, backgroundColor: 'var(--bg-surface0)',
    borderRadius: 8, border: '1px solid var(--bg-surface1)',
  },
  keyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  keyName: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  keyType: { fontSize: 11, color: 'var(--accent-blue)', fontWeight: 700, fontFamily: 'monospace' },
  fingerprint: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 8, wordBreak: 'break-all' },
  keyActions: { display: 'flex', gap: 8 },
  smallBtn: {
    padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--bg-surface1)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--accent-red)',
    border: '1px solid var(--accent-red)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
};
