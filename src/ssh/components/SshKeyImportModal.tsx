import React, { useState } from 'react';
import { Ssh } from '../index';
import { OVERLAY, INPUT_FIELD } from '../../lib/styles';

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export function SshKeyImportModal({ onDone, onCancel }: Props) {
  const [name, setName] = useState('');
  const [keyData, setKeyData] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!name.trim() || !keyData.trim()) return;
    setImporting(true);
    setError('');
    try {
      await Ssh.importSshKey({
        name: name.trim(),
        keyData: keyData.trim(),
        passphrase: passphrase || undefined,
      });
      onDone();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('passphrase required') || msg.includes('encrypted')) {
        setNeedsPassphrase(true);
        setError('This key is encrypted. Enter the passphrase.');
      } else {
        setError(msg);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Import SSH Key</h3>

        <div style={styles.field}>
          <label style={styles.label}>Key Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. imported-key"
            style={styles.input}
            autoComplete="off"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Private Key</label>
          <textarea
            value={keyData}
            onChange={(e) => setKeyData(e.target.value)}
            placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
            style={styles.textarea}
            rows={6}
            spellCheck={false}
          />
        </div>

        {needsPassphrase && (
          <div style={styles.field}>
            <label style={styles.label}>Passphrase</label>
            <input
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              type="password"
              placeholder="Enter passphrase"
              style={styles.input}
              autoComplete="off"
            />
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleImport}
            disabled={!name.trim() || !keyData.trim() || importing}
            style={{ ...styles.importBtn, opacity: name.trim() && keyData.trim() && !importing ? 1 : 0.5 }}
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modal: {
    backgroundColor: 'var(--bg-base)', borderRadius: 12, padding: 20,
    width: '90%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto',
    border: '1px solid var(--bg-surface1)',
  },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  label: { fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  input: INPUT_FIELD,
  textarea: {
    ...INPUT_FIELD,
    fontFamily: 'monospace',
    fontSize: 12,
    resize: 'vertical' as const,
    lineHeight: 1.4,
  },
  error: { fontSize: 13, color: 'var(--accent-red)', margin: '0 0 12px' },
  actions: { display: 'flex', gap: 8, marginTop: 16 },
  cancelBtn: {
    flex: 1, padding: '12px', backgroundColor: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--bg-surface1)', borderRadius: 8, fontSize: 14, cursor: 'pointer',
  },
  importBtn: {
    flex: 1, padding: '12px', backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
