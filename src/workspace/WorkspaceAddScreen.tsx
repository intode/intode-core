import React, { useState } from 'react';
import { Workspace, CreateWorkspaceData } from './WorkspaceManager';
import { Ssh } from '../ssh/index';
import { DEFAULT_SSH_PORT } from '../lib/constants';
import { BUTTON_PRIMARY, BUTTON_OUTLINE_ACCENT, INPUT_FIELD } from '../lib/styles';

export interface WorkspaceAddScreenProps {
  onSave: (data: CreateWorkspaceData, password: string) => void;
  onCancel: () => void;
  editWorkspace?: Workspace;
}

export function WorkspaceAddScreen({ onSave, onCancel, editWorkspace }: WorkspaceAddScreenProps) {
  const isEdit = !!editWorkspace;
  const [name, setName] = useState(editWorkspace?.name ?? '');
  const [host, setHost] = useState(editWorkspace?.host ?? '');
  const [port, setPort] = useState(String(editWorkspace?.port ?? DEFAULT_SSH_PORT));
  const [username, setUsername] = useState(editWorkspace?.username ?? '');
  const [password, setPassword] = useState('');
  const [defaultPath, setDefaultPath] = useState(editWorkspace?.defaultPath ?? '~');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testError, setTestError] = useState('');

  // Password is optional when editing (only enter to change)
  const canSave = name.trim() && host.trim() && username.trim() && (isEdit || password.trim());
  const canTest = host.trim() && username.trim() && password.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || DEFAULT_SSH_PORT,
      username: username.trim(),
      authType: 'password',
      defaultPath: defaultPath.trim() || '~',
    }, password);
  };

  const handleTest = async () => {
    if (!canTest) return;
    setTestStatus('testing');
    setTestError('');
    try {
      const { sessionId } = await Ssh.connect({
        host: host.trim(),
        port: parseInt(port) || DEFAULT_SSH_PORT,
        username: username.trim(),
        password,
      });
      await Ssh.disconnect({ sessionId });
      setTestStatus('success');
    } catch (e: any) {
      setTestStatus('fail');
      setTestError(e?.message ?? String(e));
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onCancel} style={styles.closeBtn}>✕</button>
        <span style={styles.title}>{isEdit ? 'Edit Workspace' : 'Add Workspace'}</span>
      </div>
      <div style={styles.form}>
        <Field label="Name" value={name} onChange={setName} placeholder="My Server" />
        <Field label="Host" value={host} onChange={setHost} placeholder="192.168.1.10" />
        <Field label="Port" value={port} onChange={setPort} placeholder="22" inputMode="numeric" />
        <Field label="Username" value={username} onChange={setUsername} placeholder="user" />
        <Field
          label={isEdit ? 'Password (enter to change)' : 'Password'}
          value={password} onChange={setPassword}
          placeholder={isEdit ? 'Leave empty to keep current' : '••••••••'}
          type="password"
        />
        <Field label="Default Path" value={defaultPath} onChange={setDefaultPath} placeholder="~" />

        <button
          onClick={handleTest}
          disabled={!canTest || testStatus === 'testing'}
          style={{ ...styles.testBtn, opacity: canTest && testStatus !== 'testing' ? 1 : 0.5 }}
        >
          {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        {testStatus === 'success' && (
          <p style={{ color: 'var(--accent-green)', fontSize: 13, textAlign: 'center', margin: 0 }}>✓ Connection successful</p>
        )}
        {testStatus === 'fail' && (
          <p style={{ color: 'var(--accent-red)', fontSize: 13, textAlign: 'center', wordBreak: 'break-all', margin: 0 }}>
            ✕ {testError}
          </p>
        )}

        <button onClick={handleSave} disabled={!canSave} style={{ ...styles.saveBtn, opacity: canSave ? 1 : 0.5 }}>
          Save
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, inputMode }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        style={styles.input}
        autoComplete="off"
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--bg-surface0)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer', padding: 4 },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' },
  form: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 },
  input: {
    backgroundColor: 'var(--bg-surface0)', border: '1px solid var(--bg-surface1)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
    fontSize: 15, outline: 'none',
  },
  testBtn: {
    padding: '10px', backgroundColor: 'transparent', color: 'var(--accent-blue)',
    border: '1px solid var(--accent-blue)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
  saveBtn: {
    marginTop: 4, padding: '14px', backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
};
