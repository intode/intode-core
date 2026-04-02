import React, { useState, useEffect } from 'react';
import { Workspace, CreateWorkspaceData } from './WorkspaceManager';
import { Ssh } from '../ssh/index';
import type { SshKey } from '../ssh/plugin-api';
import { DEFAULT_SSH_PORT } from '../lib/constants';
import { INPUT_FIELD } from '../lib/styles';

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
  const [authType, setAuthType] = useState<'password' | 'key'>(editWorkspace?.authType ?? 'password');
  const [password, setPassword] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState<string>(editWorkspace?.keyId ?? '');
  const [sshKeys, setSshKeys] = useState<SshKey[]>([]);
  const [defaultPath, setDefaultPath] = useState(editWorkspace?.defaultPath ?? '~');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    Ssh.listSshKeys().then(({ keys }) => setSshKeys(keys)).catch(() => {});
  }, []);

  const canSave = name.trim() && host.trim() && username.trim() && (
    authType === 'key'
      ? !!selectedKeyId
      : (isEdit || password.trim())
  );

  const canTest = host.trim() && username.trim() && (
    authType === 'key' ? !!selectedKeyId : password.trim()
  );

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || DEFAULT_SSH_PORT,
      username: username.trim(),
      authType,
      keyId: authType === 'key' ? selectedKeyId : undefined,
      defaultPath: defaultPath.trim() || '~',
    }, password);
  };

  const handleTest = async () => {
    if (!canTest) return;
    setTestStatus('testing');
    setTestError('');
    try {
      const opts: import('../ssh/plugin-api').ConnectOptions = {
        host: host.trim(),
        port: parseInt(port) || DEFAULT_SSH_PORT,
        username: username.trim(),
      };
      if (authType === 'key') {
        opts.keyId = selectedKeyId;
      } else {
        opts.password = password;
      }
      const { sessionId } = await Ssh.connect(opts);
      await Ssh.disconnect({ sessionId });
      setTestStatus('success');
    } catch (e: unknown) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onCancel} style={styles.closeBtn}>{'\u2715'}</button>
        <span style={styles.title}>{isEdit ? 'Edit Workspace' : 'Add Workspace'}</span>
      </div>
      <div style={styles.form}>
        <Field label="Name" value={name} onChange={setName} placeholder="My Server" />
        <Field label="Host" value={host} onChange={setHost} placeholder="192.168.1.10" />
        <Field label="Port" value={port} onChange={setPort} placeholder="22" inputMode="numeric" />
        <Field label="Username" value={username} onChange={setUsername} placeholder="user" />

        {/* Auth type selector */}
        <div style={styles.field}>
          <label style={styles.label}>Authentication</label>
          <div style={styles.authToggle}>
            <button
              onClick={() => setAuthType('password')}
              style={authType === 'password' ? styles.authActive : styles.authInactive}
            >Password</button>
            <button
              onClick={() => setAuthType('key')}
              style={authType === 'key' ? styles.authActive : styles.authInactive}
            >SSH Key</button>
          </div>
        </div>

        {authType === 'password' ? (
          <Field
            label={isEdit ? 'Password (enter to change)' : 'Password'}
            value={password} onChange={setPassword}
            placeholder={isEdit ? 'Leave empty to keep current' : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
            type="password"
          />
        ) : (
          <div style={styles.field}>
            <label style={styles.label}>SSH Key</label>
            {sshKeys.length === 0 ? (
              <p style={styles.noKeys}>No SSH keys stored. Generate or import a key in Settings.</p>
            ) : (
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                style={styles.select}
              >
                <option value="">Select a key...</option>
                {sshKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.type})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <Field label="Default Path" value={defaultPath} onChange={setDefaultPath} placeholder="~" />

        <button
          onClick={handleTest}
          disabled={!canTest || testStatus === 'testing'}
          style={{ ...styles.testBtn, opacity: canTest && testStatus !== 'testing' ? 1 : 0.5 }}
        >
          {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        {testStatus === 'success' && (
          <p style={{ color: 'var(--accent-green)', fontSize: 13, textAlign: 'center', margin: 0 }}>
            {'\u2713'} Connection successful
          </p>
        )}
        {testStatus === 'fail' && (
          <p style={{ color: 'var(--accent-red)', fontSize: 13, textAlign: 'center', wordBreak: 'break-all', margin: 0 }}>
            {'\u2715'} {testError}
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
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 4 },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.3 },
  form: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  input: INPUT_FIELD,
  select: {
    ...INPUT_FIELD,
    appearance: 'none' as const,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236c7086\' d=\'M2 4l4 4 4-4\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 32,
  },
  noKeys: { fontSize: 13, color: 'var(--text-muted)', margin: 0 },
  authToggle: { display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bg-surface1)' },
  authActive: {
    flex: 1, padding: '10px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
  },
  authInactive: {
    flex: 1, padding: '10px', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    backgroundColor: 'var(--bg-surface0)', color: 'var(--text-secondary)',
  },
  testBtn: {
    padding: '12px', backgroundColor: 'transparent', color: 'var(--accent-blue)',
    border: '1px solid var(--accent-blue)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
  saveBtn: {
    marginTop: 4, padding: '12px', backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
