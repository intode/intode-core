import React, { useState } from 'react';
import { Ssh } from '../index';
import { OVERLAY, INPUT_FIELD } from '../../lib/styles';
import { COPY_FEEDBACK_MS } from '../../lib/constants';

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export function SshKeyGenerateModal({ onDone, onCancel }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'ed25519' | 'rsa'>('ed25519');
  const [generating, setGenerating] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!name.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const key = await Ssh.generateSshKey({ name: name.trim(), type });
      setPublicKey(key.publicKey);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch { /* clipboard not available */ }
  };

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Generate SSH Key</h3>

        {publicKey ? (
          <>
            <p style={styles.successText}>Key generated! Add this public key to your server's ~/.ssh/authorized_keys:</p>
            <div style={styles.pubKeyBox}>{publicKey}</div>
            <div style={styles.actions}>
              <button onClick={handleCopy} style={styles.copyBtn}>
                {copied ? 'Copied!' : 'Copy Public Key'}
              </button>
              <button onClick={onDone} style={styles.doneBtn}>Done</button>
            </div>
          </>
        ) : (
          <>
            <div style={styles.field}>
              <label style={styles.label}>Key Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. my-server"
                style={styles.input}
                autoComplete="off"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Key Type</label>
              <div style={styles.typeToggle}>
                <button
                  onClick={() => setType('ed25519')}
                  style={type === 'ed25519' ? styles.typeActive : styles.typeInactive}
                >
                  Ed25519 (Recommended)
                </button>
                <button
                  onClick={() => setType('rsa')}
                  style={type === 'rsa' ? styles.typeActive : styles.typeInactive}
                >
                  RSA 4096
                </button>
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.actions}>
              <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={!name.trim() || generating}
                style={{ ...styles.genBtn, opacity: name.trim() && !generating ? 1 : 0.5 }}
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </>
        )}
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
  typeToggle: { display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bg-surface1)' },
  typeActive: {
    flex: 1, padding: '10px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
  },
  typeInactive: {
    flex: 1, padding: '10px', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    backgroundColor: 'var(--bg-surface0)', color: 'var(--text-secondary)',
  },
  error: { fontSize: 13, color: 'var(--accent-red)', margin: '0 0 12px' },
  actions: { display: 'flex', gap: 8, marginTop: 16 },
  cancelBtn: {
    flex: 1, padding: '12px', backgroundColor: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--bg-surface1)', borderRadius: 8, fontSize: 14, cursor: 'pointer',
  },
  genBtn: {
    flex: 1, padding: '12px', backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  successText: { fontSize: 13, color: 'var(--accent-green)', margin: '0 0 12px' },
  pubKeyBox: {
    padding: 10, backgroundColor: 'var(--bg-surface0)', borderRadius: 8,
    fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)',
    wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto',
    border: '1px solid var(--bg-surface1)',
  },
  copyBtn: {
    flex: 1, padding: '12px', backgroundColor: 'transparent', color: 'var(--accent-blue)',
    border: '1px solid var(--accent-blue)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
  doneBtn: {
    flex: 1, padding: '12px', backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
