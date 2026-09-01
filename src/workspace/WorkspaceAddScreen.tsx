import React, { useState, useEffect, useCallback } from 'react';
import { Workspace, CreateWorkspaceData, WorkspaceJumpHost, getWorkspaceStore } from './WorkspaceManager';
import { Ssh } from '../ssh/index';
import { getSshCapabilities } from '../ssh/capabilities';
import { unavailableTitle } from '../ssh/unavailable';
import type { SshKey, HostKeyPrompt } from '../ssh/plugin-api';
import { getPendingHostKeyPrompt, trustHostKey } from '../ssh/host-key';
import { HostKeyTrustPrompt } from '../ssh/components/HostKeyTrustPrompt';
import { DEFAULT_SSH_PORT } from '../lib/constants';
import { INPUT_FIELD } from '../lib/styles';
import { isJumpHostVisible } from './workspace-form-hooks';
import { SshKeyGenerateModal } from '../ssh/components/SshKeyGenerateModal';
import { SshKeyImportModal } from '../ssh/components/SshKeyImportModal';

export interface WorkspaceAddScreenProps {
  onSave: (data: CreateWorkspaceData, password: string, jumpHostPasswords?: string[]) => void;
  onCancel: () => void;
  editWorkspace?: Workspace;
  hasActiveSession?: boolean;
}

export function WorkspaceAddScreen({ onSave, onCancel, editWorkspace, hasActiveSession }: WorkspaceAddScreenProps) {
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
  const [jumpHosts, setJumpHosts] = useState<WorkspaceJumpHost[]>(editWorkspace?.jumpHosts ?? []);
  const [jumpHostPasswords, setJumpHostPasswords] = useState<string[]>([]);
  const [showJumpHost, setShowJumpHost] = useState((editWorkspace?.jumpHosts?.length ?? 0) > 0);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail' | 'hostkey'>('idle');
  const [testError, setTestError] = useState('');
  const [testHostKey, setTestHostKey] = useState<HostKeyPrompt | null>(null);
  const [showKeyGenerate, setShowKeyGenerate] = useState(false);
  const [showKeyImport, setShowKeyImport] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [savedJumpHostCount, setSavedJumpHostCount] = useState(0);

  // Key auth needs both halves: a runtime that can list and store keys, and a
  // connect() that actually honours the key it is handed. One without the other
  // produces a workspace that saves fine and never connects, which is worse than
  // no option at all — so offer the choice only when both are there.
  const { keyManagement, keyAuth } = getSshCapabilities();
  const keyAuthAvailable = keyManagement && keyAuth;
  // A workspace already set to key auth keeps showing the option, so its owner can
  // see and change their own setting instead of finding it silently rewritten.
  const showKeyOption = keyAuthAvailable || authType === 'key';

  const refreshKeys = useCallback(() => {
    if (!keyManagement) return;
    Ssh.listSshKeys().then(({ keys }) => {
      setSshKeys(keys);
      // Auto-select the newest key if none selected
      if (!selectedKeyId && keys.length > 0) {
        setSelectedKeyId(keys[keys.length - 1].id);
      }
    }).catch(() => {});
  }, [selectedKeyId, keyManagement]);

  useEffect(() => { refreshKeys(); }, []);

  // Load saved passwords for edit mode (enables Test Connection without re-entry)
  useEffect(() => {
    if (!isEdit || !editWorkspace) return;
    getWorkspaceStore().getPassword(editWorkspace.id).then((pw) => {
      if (pw) { setPassword(pw); setHasSavedPassword(true); }
    }).catch(() => {});
    if (editWorkspace.jumpHosts?.length) {
      getWorkspaceStore().getJumpHostPasswords(editWorkspace.id).then((pws) => {
        if (pws.length > 0) { setJumpHostPasswords(pws); setSavedJumpHostCount(pws.filter(p => !!p).length); }
      }).catch(() => {});
    }
  }, [isEdit, editWorkspace]);

  const canSave = name.trim() && host.trim() && username.trim() && (
    authType === 'key'
      ? !!selectedKeyId
      : (isEdit || password.trim())
  );

  // Saving a key-auth workspace stays allowed even where key auth does not work —
  // it may have been made on another device and hiding it would lose the setting.
  // Testing it is another matter: the attempt can only fail, so do not offer it.
  const canTest = host.trim() && username.trim() && (
    authType === 'key' ? (keyAuthAvailable && !!selectedKeyId) : password.trim()
  );

  // Without listSshKeys the name is unknowable, so fall back to the stored id —
  // still the user's own setting, still recognisable next to the one they saved.
  const savedKey = sshKeys.find((k) => k.id === selectedKeyId);
  const savedKeyLabel = savedKey
    ? `${savedKey.name} (${savedKey.type})`
    : selectedKeyId || 'No key selected';

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
      jumpHosts: jumpHosts.length > 0 ? jumpHosts : undefined,
    }, password, jumpHostPasswords.length > 0 ? jumpHostPasswords : undefined);
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
      if (jumpHosts.length > 0) {
        opts.jumpHosts = jumpHosts.map((jh) => ({
          host: jh.host,
          port: jh.port,
          username: jh.username,
          authType: jh.authType,
          keyId: jh.keyId,
          // Password for jump hosts stored in jumpHostPasswords
          password: jumpHostPasswords[jumpHosts.indexOf(jh)] ?? undefined,
        }));
      }
      let sessionId: string;
      try {
        ({ sessionId } = await Ssh.connect(opts));
      } catch (e: unknown) {
        // Adding a workspace is exactly the moment a server is not trusted yet, so a
        // refused host key is the likeliest failure here — and it arrives as a plain
        // connect error. Ask the plugin the same way ConnectingScreen does, on every
        // failure, because a jump chain can stop at a hop this form never named.
        const prompt = await getPendingHostKeyPrompt();
        if (prompt) {
          setTestHostKey(prompt);
          setTestStatus('hostkey');
          return;
        }
        setTestStatus('fail');
        setTestError(e instanceof Error ? e.message : String(e));
        return;
      }
      // The connection answered the question, so hand it straight back — a test must
      // never leave a session behind. A disconnect that fails leaves nothing the user
      // could act on and does not unmake a successful login, so it does not become a
      // failed test.
      try {
        await Ssh.disconnect({ sessionId });
      } catch { /* the session is the plugin's to clean up from here */ }
      setTestStatus('success');
    } catch (e: unknown) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Trust the offered key, then run the same test again — a chain may stop at a further hop. */
  const acceptTestHostKey = async () => {
    const prompt = testHostKey;
    if (!prompt) return;
    setTestStatus('testing');
    try {
      await trustHostKey(prompt);
    } catch (e: unknown) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : String(e));
      return;
    }
    setTestHostKey(null);
    await handleTest();
  };

  const rejectTestHostKey = () => {
    setTestHostKey(null);
    setTestStatus('fail');
    setTestError('Host key not trusted.');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onCancel} style={styles.closeBtn}>{'\u2715'}</button>
        <span style={styles.title}>{isEdit ? 'Edit Workspace' : 'Add Workspace'}</span>
      </div>
      <div style={styles.form}>
        {isEdit && hasActiveSession && (
          <div style={bannerStyle}>
            Connection changes (host, port, user, auth, password, key) will apply on next connect. Current session is unaffected.
          </div>
        )}
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
            {showKeyOption && (
              <button
                onClick={() => setAuthType('key')}
                style={authType === 'key' ? styles.authActive : styles.authInactive}
              >SSH Key</button>
            )}
          </div>
        </div>

        {authType === 'password' ? (
          <Field
            label={isEdit && hasSavedPassword ? 'Password (enter to change)' : 'Password'}
            value={password} onChange={setPassword}
            placeholder={isEdit && hasSavedPassword ? 'Leave empty to keep current' : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
            type="password"
          />
        ) : !keyAuthAvailable ? (
          <div style={styles.field}>
            <label style={styles.label}>SSH Key</label>
            <div style={styles.readOnly}>{savedKeyLabel}</div>
            <p style={styles.noKeys}>{unavailableTitle('Key authentication')}</p>
          </div>
        ) : (
          <div style={styles.field}>
            <label style={styles.label}>SSH Key</label>
            {sshKeys.length > 0 && (
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
            <div style={styles.keyActions}>
              <button onClick={() => setShowKeyGenerate(true)} style={styles.keyActionBtn}>+ Generate</button>
              <button onClick={() => setShowKeyImport(true)} style={styles.keyActionBtn}>+ Import</button>
            </div>
          </div>
        )}

        <Field label="Default Path" value={defaultPath} onChange={setDefaultPath} placeholder="~" />

        {/* Jump Host (Pro) */}
        {isJumpHostVisible() && (
          <div style={styles.field}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={styles.label}>Jump Host (Bastion)</label>
              <button
                onClick={() => {
                  if (showJumpHost) { setJumpHosts([]); setJumpHostPasswords([]); }
                  else { setJumpHosts([{ host: '', port: 22, username: '', authType: 'password' }]); setJumpHostPasswords(['']); }
                  setShowJumpHost(!showJumpHost);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >{showJumpHost ? 'Remove' : '+ Add'}</button>
            </div>
            {showJumpHost && jumpHosts.map((jh, idx) => (
              <div key={idx} style={{ marginTop: 8, padding: 10, backgroundColor: 'var(--bg-surface0)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>HOP {idx + 1}</span>
                  {jumpHosts.length > 1 && (
                    <button onClick={() => {
                      setJumpHosts(jumpHosts.filter((_, i) => i !== idx));
                      setJumpHostPasswords(jumpHostPasswords.filter((_, i) => i !== idx));
                    }} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 12, cursor: 'pointer' }}>{'\u2715'}</button>
                  )}
                </div>
                <input
                  value={jh.host} placeholder="bastion.example.com"
                  onChange={(e) => { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], host: e.target.value }; setJumpHosts(nj); }}
                  style={{ ...styles.input, fontSize: 13, padding: '8px 10px' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={jh.port === 0 ? '' : String(jh.port)} placeholder="22" inputMode="numeric"
                    onChange={(e) => { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], port: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) }; setJumpHosts(nj); }}
                    onBlur={(e) => { if (!e.target.value) { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], port: 22 }; setJumpHosts(nj); } }}
                    style={{ ...styles.input, fontSize: 13, padding: '8px 10px', width: 60 }}
                  />
                  <input
                    value={jh.username} placeholder="user"
                    onChange={(e) => { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], username: e.target.value }; setJumpHosts(nj); }}
                    style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 1 }}
                  />
                </div>
                <div style={styles.authToggle}>
                  <button
                    onClick={() => { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], authType: 'password' }; setJumpHosts(nj); }}
                    style={jh.authType === 'password' ? { ...styles.authActive, padding: '6px', fontSize: 11 } : { ...styles.authInactive, padding: '6px', fontSize: 11 }}
                  >Password</button>
                  {(keyAuthAvailable || jh.authType === 'key') && (
                    <button
                      onClick={() => { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], authType: 'key' }; setJumpHosts(nj); }}
                      style={jh.authType === 'key' ? { ...styles.authActive, padding: '6px', fontSize: 11 } : { ...styles.authInactive, padding: '6px', fontSize: 11 }}
                    >SSH Key</button>
                  )}
                </div>
                {jh.authType === 'password' ? (
                  <input
                    type="password" value={jumpHostPasswords[idx] ?? ''}
                    placeholder={isEdit && idx < savedJumpHostCount ? 'Leave empty to keep current' : 'Password'}
                    onChange={(e) => { const np = [...jumpHostPasswords]; np[idx] = e.target.value; setJumpHostPasswords(np); }}
                    style={{ ...styles.input, fontSize: 13, padding: '8px 10px' }}
                  />
                ) : !keyAuthAvailable ? (
                  <p style={styles.noKeys}>{unavailableTitle('Key authentication')}</p>
                ) : (
                  sshKeys.length > 0 ? (
                    <select
                      value={jh.keyId ?? ''}
                      onChange={(e) => { const nj = [...jumpHosts]; nj[idx] = { ...nj[idx], keyId: e.target.value || undefined }; setJumpHosts(nj); }}
                      style={{ ...styles.select, fontSize: 13, padding: '8px 10px' }}
                    >
                      <option value="">Select a key...</option>
                      {sshKeys.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.type})</option>)}
                    </select>
                  ) : (
                    <p style={styles.noKeys}>No SSH keys stored.</p>
                  )
                )}
              </div>
            ))}
            {showJumpHost && (
              <button
                onClick={() => { setJumpHosts([...jumpHosts, { host: '', port: 22, username: '', authType: 'password' }]); setJumpHostPasswords([...jumpHostPasswords, '']); }}
                style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
              >+ Add another hop</button>
            )}
          </div>
        )}

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

      {showKeyGenerate && (
        <SshKeyGenerateModal
          onDone={() => { setShowKeyGenerate(false); refreshKeys(); }}
          onCancel={() => setShowKeyGenerate(false)}
        />
      )}
      {showKeyImport && (
        <SshKeyImportModal
          onDone={() => { setShowKeyImport(false); refreshKeys(); }}
          onCancel={() => setShowKeyImport(false)}
        />
      )}
      {/* Full screen on purpose: the same decision, in the same shape, as the one the
          connect flow shows. Squeezing it under the button would make an unknown key
          and a changed key look like two more lines of test output. */}
      {testStatus === 'hostkey' && testHostKey && (
        <div style={styles.hostKeyOverlay}>
          <HostKeyTrustPrompt prompt={testHostKey} onTrust={acceptTestHostKey} onCancel={rejectTestHostKey} />
        </div>
      )}
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

const bannerStyle: React.CSSProperties = {
  padding: '10px 14px',
  marginBottom: 12,
  backgroundColor: 'var(--bg-surface0)',
  border: '1px solid var(--accent-yellow, #e5c07b)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 12,
  lineHeight: 1.4,
};

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
  noKeys: { margin: 0, fontSize: 12, color: 'var(--text-muted)' },
  readOnly: {
    ...INPUT_FIELD,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface0)',
    wordBreak: 'break-all' as const,
  },
  hostKeyOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  keyActions: { display: 'flex', gap: 8 },
  keyActionBtn: {
    background: 'none', border: 'none', color: 'var(--accent-blue)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
  },
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
