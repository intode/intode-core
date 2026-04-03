import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TabBar } from './TabBar';
import { getExtraTabs, getTabRenderer } from './tab-registry';
import { WorkspaceListScreen } from '../workspace/WorkspaceListScreen';
import { WorkspaceAddScreen } from '../workspace/WorkspaceAddScreen';
import { WorkspaceDropdown } from '../workspace/WorkspaceDropdown';
import { ConnectingScreen } from '../workspace/ConnectingScreen';
import { SettingsScreen } from './SettingsScreen';
import { DebugOverlay } from './DebugOverlay';
import { FileTree } from '../files/FileTree';
import { CodeEditor } from '../editor/CodeEditor';
import { MarkdownPreview } from '../md-preview/MarkdownPreview';
import { EditorTabs } from '../editor/EditorTabs';
import { TerminalTabs } from '../terminal/TerminalTabs';
import { terminalManager } from '../terminal/TerminalView';
import { getActiveEditorApi } from '../editor/CodeEditor';
import { ExtraKeyBar } from '../extra-keys/ExtraKeyBar';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';
import { KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT } from '../lib/constants';
import { createWorkspace, Workspace, CreateWorkspaceData, getWorkspaceStore } from '../workspace/WorkspaceManager';
import { detectFileType, FileTab, FileTabManager } from '../files/TabManager';
import { debugLog } from '../lib/debug-log';
import { initTheme } from '../themes/theme-manager';
import { saveSessionState, loadSessionState } from './session-hooks';
import { getFilePanels, getEditorPanels } from './panel-registry';
import { getGitStatusProvider } from '../files/git-status-provider';
import type { GitStatusMap } from '../files/FileTree';
import '../themes/dark.css';

initTheme();

type Screen = 'workspace-list' | 'workspace-add' | 'connecting' | 'workspace-view' | 'settings';

export const APP_VERSION = __APP_VERSION__;
export const BUILD_NUMBER = __BUILD_NUMBER__;

interface ConnectedWorkspace {
  wsId: string;
  workspace: Workspace;
  sessionId: string;
  sftpId: string | null;
  sftpError: string | null;
}

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const diff = window.innerHeight - vv.height;
      setHeight(diff > 50 ? diff : 0);
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);
  return height;
}

// --- Sub-panel bar (for Pro panels injected into Files/Editor tabs) ---

function SubPanelBar({ items, active, onChange }: {
  items: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  if (items.length <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 0, backgroundColor: 'var(--bg-mantle)', borderBottom: '1px solid var(--bg-surface0)', flexShrink: 0 }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          style={{
            flex: 1, padding: '6px 0', border: 'none', fontSize: 11, fontWeight: active === item.id ? 700 : 500,
            cursor: 'pointer', backgroundColor: 'transparent',
            color: active === item.id ? 'var(--accent-blue)' : 'var(--text-muted)',
            borderBottom: active === item.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
          }}
        >{item.label}</button>
      ))}
    </div>
  );
}

// --- Per-workspace Editor panel (self-contained state) ---

function WorkspaceEditor({ ftm, sftpId, editorPanels, visible }: {
  ftm: FileTabManager; sftpId: string | null;
  editorPanels: Array<{ id: string; label: string; component: React.ComponentType<{ visible: boolean }> }>;
  visible: boolean;
}) {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [active, setActive] = useState<FileTab | null>(null);
  const [mdPreview, setMdPreview] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null); // 'git-file' etc.

  useEffect(() => {
    const sync = () => {
      setTabs([...ftm.getTabs()]);
      setActive(ftm.getActiveTab());
    };
    ftm.setOnChange(sync);
    sync();
    return () => ftm.setOnChange(() => {});
  }, [ftm]);

  useEffect(() => { setMdPreview(false); setOverlay(null); }, [active?.id]);

  const isMd = active?.type === 'markdown';

  return (
    <>
      <EditorTabs
        tabs={tabs}
        activeTabId={active?.id ?? null}
        onSelect={(id) => ftm.setActiveTab(id)}
        onClose={(id) => ftm.closeTab(id)}
      />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {active?.content != null ? (
          isMd && mdPreview ? (
            <MarkdownPreview content={active.content} visible={visible} />
          ) : (
            <CodeEditor
              content={active.content}
              fileName={active.fileName}
              visible={visible && !overlay}
              onContentChange={(c) => ftm.updateContent(active.id, c)}
              onSave={() => { if (sftpId) ftm.saveFile(sftpId, active.id).catch(() => {}); }}
            />
          )
        ) : active?.isLoading ? (
          <div style={styles.placeholder}>
            <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
          </div>
        ) : (
          <div style={styles.placeholder}>
            <span style={{ color: 'var(--text-muted)' }}>Select a file</span>
          </div>
        )}

        {/* Overlay panels (Git file history etc.) */}
        {overlay && editorPanels.map((panel) => (
          panel.id === overlay ? (
            <div key={panel.id} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
              <panel.component visible={visible} />
            </div>
          ) : null
        ))}

        {/* Floating action buttons — bottom right */}
        {active?.content != null && (
          <div style={styles.fab}>
            {editorPanels.map((p) => (
              <button key={p.id} onClick={() => setOverlay(overlay === p.id ? null : p.id)}
                style={{ ...styles.fabBtn, backgroundColor: overlay === p.id ? 'var(--accent-blue)' : 'var(--bg-surface1)', color: overlay === p.id ? 'var(--bg-base)' : 'var(--text-secondary)' }}>
                {p.label}
              </button>
            ))}
            {isMd && (
              <button onClick={() => { setMdPreview((v) => !v); setOverlay(null); }}
                style={{ ...styles.fabBtn, backgroundColor: mdPreview ? 'var(--accent-blue)' : 'var(--bg-surface1)', color: mdPreview ? 'var(--bg-base)' : 'var(--text-secondary)' }}>
                {mdPreview ? 'Edit' : 'MD'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// --- Main App ---

export function App() {
  const keyboardHeight = useKeyboardHeight();
  const [screen, setScreen] = useState<Screen>('workspace-list');
  const [activeTab, setActiveTab] = useState<string>('terminal');
  const prevTabRef = useRef<string>('terminal');
  const [debugEnabled, setDebugEnabled] = useState(() => localStorage.getItem('intode_debug') === 'true');
  const [fileSubTab, setFileSubTab] = useState('tree');

  const filePanels = getFilePanels();
  const editorPanels = getEditorPanels();
  const fileSubItems = [{ id: 'tree', label: 'Files' }, ...filePanels.map((p) => ({ id: p.id, label: p.label }))];

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'settings') prevTabRef.current = activeTab;
    setActiveTab(tab);
  }, [activeTab]);

  // Prevent Android native context menu (복사/번역/모두선택 popup)
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  const toggleDebug = useCallback((enabled: boolean) => {
    setDebugEnabled(enabled);
    localStorage.setItem('intode_debug', String(enabled));
  }, []);

  const [connections, setConnections] = useState<ConnectedWorkspace[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [connectingWorkspace, setConnectingWorkspace] = useState<Workspace | null>(null);

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [addReturnTo, setAddReturnTo] = useState<'list' | 'view'>('list');
  const [listKey, setListKey] = useState(0);

  // Per-workspace FileTabManagers (stable across renders)
  const ftmRef = useRef(new Map<string, FileTabManager>());

  const activeConn = connections.find((c) => c.wsId === activeWsId) ?? null;
  const connectedIds = new Set(connections.map((c) => c.wsId));

  // Expose connection context for Pro split view / git tab
  useEffect(() => {
    if (activeConn) {
      (window as any).__intodeSplitCtx = {
        sessionId: activeConn.sessionId,
        sftpId: activeConn.sftpId,
        defaultPath: activeConn.workspace.defaultPath,
        ftm: getFileTabMgr(activeConn.wsId),
      };
    } else {
      delete (window as any).__intodeSplitCtx;
    }
  }, [activeConn?.sessionId, activeConn?.sftpId, activeConn?.wsId]);

  // Git status for file tree (Pro injects provider)
  const [gitStatusMap, setGitStatusMap] = useState<GitStatusMap>(new Map());
  useEffect(() => {
    const provider = getGitStatusProvider();
    if (!provider || !activeConn) { setGitStatusMap(new Map()); return; }
    let cancelled = false;
    provider(activeConn.sessionId, activeConn.workspace.defaultPath).then((m) => {
      if (!cancelled) setGitStatusMap(m);
    }).catch(() => {});
    // Refresh every 30s
    const interval = setInterval(() => {
      if (!activeConn) return;
      provider(activeConn.sessionId, activeConn.workspace.defaultPath).then((m) => {
        if (!cancelled) setGitStatusMap(m);
      }).catch(() => {});
    }, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeConn?.sessionId, activeConn?.workspace.defaultPath]);

  const getFileTabMgr = useCallback((wsId: string): FileTabManager => {
    let mgr = ftmRef.current.get(wsId);
    if (!mgr) {
      mgr = new FileTabManager();
      ftmRef.current.set(wsId, mgr);
    }
    return mgr;
  }, []);

  // --- Android hardware back button ---
  const screenRef = useRef(screen);
  const activeTabRef = useRef(activeTab);
  const connectionsRef2 = useRef(connections);
  const addReturnToRef = useRef(addReturnTo);
  screenRef.current = screen;
  activeTabRef.current = activeTab;
  connectionsRef2.current = connections;
  addReturnToRef.current = addReturnTo;

  useEffect(() => {
    (window as any).__intodeBackHandler = (): boolean => {
      const s = screenRef.current;
      const t = activeTabRef.current;
      const hasConn = connectionsRef2.current.length > 0;

      // Settings sub-page → menu first, then tab/screen back
      if ((s === 'workspace-view' && t === 'settings') || s === 'settings') {
        const settingsBack = (window as any).__intodeSettingsBack as (() => boolean) | undefined;
        if (settingsBack && settingsBack()) return true;
        if (s === 'workspace-view') { setActiveTab(prevTabRef.current); return true; }
        setScreen(hasConn ? 'workspace-view' : 'workspace-list');
        return true;
      }
      if (s === 'workspace-add') {
        setEditingWorkspace(null);
        setScreen(addReturnToRef.current === 'view' ? 'workspace-view' : 'workspace-list');
        return true;
      }
      if (s === 'connecting') {
        setConnectingWorkspace(null);
        setScreen(hasConn ? 'workspace-view' : 'workspace-list');
        return true;
      }
      if (s === 'workspace-view') {
        if (t !== 'files') { setActiveTab('files'); return true; }
        setScreen('workspace-list');
        return true;
      }
      return false; // workspace-list → system minimizes app
    };
    return () => { delete (window as any).__intodeBackHandler; };
  }, []);

  // --- Handlers ---

  const handleSelectWorkspace = useCallback(
    (ws: Workspace) => {
      const existing = connections.find((c) => c.wsId === ws.id);
      if (existing) {
        setActiveWsId(ws.id);
        if (screen !== 'workspace-view') setScreen('workspace-view');
        return;
      }
      setConnectingWorkspace(ws);
      setScreen('connecting');
    },
    [connections, screen],
  );

  const handleConnected = useCallback(
    async (sid: string) => {
      const ws = connectingWorkspace;
      if (!ws) return;
      debugLog(`Connected sessionId=${sid}`);

      let sftpId: string | null = null;
      let sftpError: string | null = null;
      try {
        const res = await Ssh.openSftp({ sessionId: sid });
        sftpId = res.sftpId;
        debugLog(`SFTP opened sftpId=${sftpId}`);
      } catch (e) {
        debugLog(`SFTP error: ${e}`);
        sftpError = String(e);
      }

      setConnections((prev) => [...prev, { wsId: ws.id, workspace: ws, sessionId: sid, sftpId, sftpError }]);
      setActiveWsId(ws.id);
      setConnectingWorkspace(null);
      setScreen('workspace-view');
      setActiveTab('files');
      saveSessionState({ workspaceId: ws.id, activeTab: 'files' });
    },
    [connectingWorkspace],
  );

  const handleDisconnect = useCallback(async () => {
    if (!activeConn) return;
    try {
      if (activeConn.sftpId) await Ssh.closeSftp({ sftpId: activeConn.sftpId });
      await Ssh.disconnect({ sessionId: activeConn.sessionId });
    } catch {
      /* ignore */
    }

    ftmRef.current.delete(activeConn.wsId);
    const remaining = connections.filter((c) => c.wsId !== activeConn.wsId);
    setConnections(remaining);

    if (remaining.length > 0) {
      setActiveWsId(remaining[0].wsId);
    } else {
      setActiveWsId(null);
      setScreen('workspace-list');
    }
  }, [activeConn, connections]);

  // --- Auto-reconnect on app resume ---
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== 'visible') return;
      const conns = connectionsRef.current;
      if (conns.length === 0) return;

      for (const conn of conns) {
        try {
          const { status } = await Ssh.getStatus({ sessionId: conn.sessionId });
          if (status === 'connected') continue;
        } catch {
          /* status check failed — assume dead */
        }

        // Reconnect
        try {
          const connectOpts: import('../ssh/plugin-api').ConnectOptions = {
            host: conn.workspace.host,
            port: conn.workspace.port,
            username: conn.workspace.username,
          };
          if (conn.workspace.authType === 'key' && conn.workspace.keyId) {
            connectOpts.keyId = conn.workspace.keyId;
          } else {
            const password = await getWorkspaceStore().getPassword(conn.wsId);
            connectOpts.password = password ?? undefined;
          }
          const { sessionId } = await Ssh.connect(connectOpts);
          let sftpId: string | null = null;
          try {
            const res = await Ssh.openSftp({ sessionId });
            sftpId = res.sftpId;
          } catch { /* sftp optional */ }

          setConnections((prev) =>
            prev.map((c) => (c.wsId === conn.wsId ? { ...c, sessionId, sftpId, sftpError: null } : c)),
          );
        } catch {
          /* reconnect failed — user will see dead terminal */
        }
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const handleSaveWorkspace = useCallback(
    async (data: CreateWorkspaceData, password: string) => {
      let newWs: Workspace | null = null;
      if (editingWorkspace) {
        const store = (await import('../workspace/WorkspaceManager')).getWorkspaceStore();
        await store.update(editingWorkspace.id, data);
        if (password) await store.savePassword(editingWorkspace.id, password);
        setEditingWorkspace(null);
      } else {
        newWs = await createWorkspace(data, password);
      }
      setListKey((k) => k + 1);

      if (addReturnTo === 'view' && newWs) {
        setConnectingWorkspace(newWs);
        setScreen('connecting');
      } else if (addReturnTo === 'view') {
        setScreen('workspace-view');
      } else {
        setScreen('workspace-list');
      }
    },
    [editingWorkspace, addReturnTo],
  );

  // --- Screens ---
  // Workspace view stays mounted when connections exist (preserves terminal sessions).
  // Other screens render as overlays on top.

  const hasConnections = connections.length > 0;
  const showWorkspaceView = screen === 'workspace-view';

  return (
    <>
      {/* Overlay screens */}
      {screen === 'settings' && (
        <div style={styles.overlay}>
          <SettingsScreen
            appVersion={APP_VERSION}
            buildNumber={BUILD_NUMBER}
            onBack={() => setScreen(hasConnections ? 'workspace-view' : 'workspace-list')}
            debugEnabled={debugEnabled}
            onDebugToggle={toggleDebug}
          />
        </div>
      )}

      {screen === 'workspace-list' && (
        <div style={styles.overlay}>
          <WorkspaceListScreen
            key={listKey}
            onSelectWorkspace={handleSelectWorkspace}
            onAddWorkspace={() => {
              setEditingWorkspace(null);
              setAddReturnTo('list');
              setScreen('workspace-add');
            }}
            onEditWorkspace={(ws) => {
              setEditingWorkspace(ws);
              setAddReturnTo('list');
              setScreen('workspace-add');
            }}
            onSettings={() => setScreen('settings')}
          />
          <DebugOverlay enabled={debugEnabled} />
        </div>
      )}

      {screen === 'workspace-add' && (
        <div style={{ ...styles.overlay, paddingBottom: keyboardHeight }}>
          <WorkspaceAddScreen
            onSave={handleSaveWorkspace}
            onCancel={() => {
              setEditingWorkspace(null);
              setScreen(addReturnTo === 'view' ? 'workspace-view' : 'workspace-list');
            }}
            editWorkspace={editingWorkspace ?? undefined}
          />
        </div>
      )}

      {screen === 'connecting' && connectingWorkspace && (
        <div style={styles.overlay}>
          <ConnectingScreen
            workspace={connectingWorkspace}
            onConnected={handleConnected}
            onFailed={() => {}}
            onCancel={() => {
              setConnectingWorkspace(null);
              setScreen(hasConnections ? 'workspace-view' : 'workspace-list');
            }}
          />
        </div>
      )}

      {/* Workspace view — always mounted if connected, hidden behind overlays */}
      {hasConnections && (
    <div style={{ ...styles.safeArea, paddingBottom: keyboardHeight, display: showWorkspaceView ? 'flex' : 'none' }}>
      <div style={styles.container}>
        {activeTab !== 'settings' && (
        <div style={styles.statusBar}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 1, background: 'var(--accent-green)' }} />
          {activeConn && (
            <WorkspaceDropdown
              current={activeConn.workspace}
              connectedIds={connectedIds}
              onSwitch={handleSelectWorkspace}
              onAdd={() => {
                setEditingWorkspace(null);
                setAddReturnTo('view');
                setScreen('workspace-add');
              }}
            />
          )}
          <span className="blink" style={{ color: 'var(--accent-green)', fontSize: 10, flexShrink: 0, textShadow: 'var(--neon-glow)' }}>{'\u25cf'}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { prevTabRef.current = activeTab; setActiveTab('settings'); }} style={styles.settingsBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2zM12 15a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
          <button onClick={handleDisconnect} style={styles.disconnectBtn}>
            HALT_SESSION
          </button>
        </div>
        )}

        <div style={styles.content}>
          {connections.map((conn) => {
            const isActive = conn.wsId === activeWsId;
            const ftm = getFileTabMgr(conn.wsId);
            return (
              <React.Fragment key={conn.wsId}>
                {/* Files — per workspace, always mounted */}
                <div style={{ ...styles.tabContent, display: isActive && activeTab === 'files' ? 'flex' : 'none' }}>
                  <SubPanelBar items={fileSubItems} active={fileSubTab} onChange={setFileSubTab} />
                  <div style={{ flex: 1, overflow: 'hidden', display: fileSubTab === 'tree' ? 'flex' : 'none', flexDirection: 'column' }}>
                    {conn.sftpId ? (
                      <FileTree
                        sftpId={conn.sftpId}
                        rootPath={conn.workspace.defaultPath}
                        sessionId={conn.sessionId}
                        gitStatus={gitStatusMap}
                        onFileSelect={async (path) => {
                          const type = detectFileType(path.split('/').pop() ?? '');
                          if (type === 'binary') return;
                          await ftm.openFile(conn.sftpId!, path);
                          setActiveTab('editor');
                        }}
                      />
                    ) : conn.sftpError ? (
                      <div style={styles.placeholder}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ color: 'var(--accent-red)', marginBottom: 8 }}>SFTP connection failed</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{conn.sftpError}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.placeholder}>
                        <span style={{ color: 'var(--text-muted)' }}>Connecting SFTP...</span>
                      </div>
                    )}
                  </div>
                  {filePanels.map((panel) => (
                    <div key={panel.id} style={{ flex: 1, overflow: 'hidden', display: fileSubTab === panel.id ? 'flex' : 'none', flexDirection: 'column' }}>
                      <panel.component visible={isActive && activeTab === 'files' && fileSubTab === panel.id} />
                    </div>
                  ))}
                </div>

                {/* Editor — per workspace, always mounted */}
                <div
                  style={{
                    ...styles.tabContent,
                    display: isActive && activeTab === 'editor' ? 'flex' : 'none',
                    flexDirection: 'column',
                  }}
                >
                  <WorkspaceEditor ftm={ftm} sftpId={conn.sftpId} editorPanels={editorPanels} visible={isActive && activeTab === 'editor'} />
                </div>

                {/* Terminal — per workspace, always mounted */}
                <div style={{ ...styles.tabContent, display: isActive && activeTab === 'terminal' ? 'flex' : 'none' }}>
                  <TerminalTabs
                    sessionId={conn.sessionId}
                    defaultPath={conn.workspace.defaultPath}
                    visible={isActive && activeTab === 'terminal'}
                  />
                </div>
              </React.Fragment>
            );
          })}
          {/* Settings tab — full screen, hides statusBar + tabBar */}
          <div style={{ ...styles.tabContent, display: activeTab === 'settings' ? 'flex' : 'none' }}>
            <SettingsScreen
              appVersion={APP_VERSION}
              buildNumber={BUILD_NUMBER}
              onBack={() => setActiveTab(prevTabRef.current)}
              debugEnabled={debugEnabled}
              onDebugToggle={toggleDebug}
            />
          </div>

          {/* Extra tabs from Pro plugins */}
          {getExtraTabs().map((tab) => {
            const Renderer = getTabRenderer(tab.id);
            return Renderer ? (
              <div key={tab.id} style={{ ...styles.tabContent, display: activeTab === tab.id ? 'flex' : 'none' }}>
                <Renderer visible={activeTab === tab.id} />
              </div>
            ) : null;
          })}
        </div>

        {(activeTab === 'terminal' || activeTab === 'editor') && (
          <ExtraKeyBar
            context={activeTab === 'terminal' ? 'terminal' : (activeConn && getFileTabMgr(activeConn.wsId).getActiveTab()?.type === 'markdown' ? 'md-editor' : 'code-editor')}
            onSuppressKeyboard={() => {
              // Android WebView ignores JS preventDefault for keyboard.
              // 1) Blur active element  2) Call Capacitor Keyboard.hide() if available
              (document.activeElement as HTMLElement)?.blur?.();
              (window as any).__intodeHideKeyboard?.();
            }}
            onKeyPress={(data) => {
              // Keyboard toggle
              if (data === 'keyboard') {
                if (activeTab === 'terminal') {
                  const el = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
                  if (el) { if (document.activeElement === el) el.blur(); else el.focus(); }
                } else if (activeTab === 'editor') {
                  const cm = document.querySelector('.cm-content') as HTMLElement | null;
                  if (cm) { if (document.activeElement === cm) cm.blur(); else cm.focus(); }
                }
                return;
              }

              if (activeTab === 'terminal') {
                const session = terminalManager.getActiveSession();
                if (session?.channelId) {
                  Ssh.writeToShell({ channelId: session.channelId, data: encodeUtf8Base64(data) }).catch(() => {});
                }
              } else if (activeTab === 'editor') {
                const editor = getActiveEditorApi();
                if (!editor) return;
                if (data === 'save') editor.save();
                else if (data === 'undo') editor.undo();
                else if (data === 'redo') editor.redo();
                else if (data === 'tab') editor.insertText('\t');
                else if (data === KEY_UP) editor.cursorUp();
                else if (data === KEY_DOWN) editor.cursorDown();
                else if (data === KEY_LEFT) editor.cursorLeft();
                else if (data === KEY_RIGHT) editor.cursorRight();
                // MD-specific commands
                else if (data === 'md:heading') editor.prependLine('# ');
                else if (data === 'md:bold') editor.wrapSelection('**', '**');
                else if (data === 'md:italic') editor.wrapSelection('_', '_');
                else if (data === 'md:code') editor.wrapSelection('```\n', '\n```');
                else if (data === 'md:list') editor.prependLine('- ');
                else if (data === 'md:quote') editor.prependLine('> ');
                else if (data === 'md:link') editor.wrapSelection('[', '](url)');
                else if (data === 'md:image') editor.wrapSelection('![', '](url)');
                else editor.insertText(data);
              }
            }}
          />
        )}
        {activeTab !== 'settings' && (
          <TabBar activeTab={activeTab} onTabChange={handleTabChange} extraTabs={getExtraTabs()} />
        )}
      </div>
      <DebugOverlay enabled={debugEnabled} />
    </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    height: '100%',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    backgroundColor: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
  },
  safeArea: {
    height: '100%',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    backgroundColor: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    backgroundColor: 'var(--bg-mantle)',
    borderBottom: '1px solid var(--bg-surface0)',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  disconnectBtn: {
    background: 'none',
    border: '1px solid var(--accent-red)',
    borderRadius: 2,
    padding: '3px 10px',
    color: 'var(--accent-red)',
    fontSize: 10,
    fontFamily: 'Chakra Petch',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tabContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    display: 'flex',
    gap: 6,
    zIndex: 10,
  },
  fabBtn: {
    padding: '6px 12px',
    borderRadius: 16,
    border: 'none',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
};
