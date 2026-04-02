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
import '../themes/dark.css';

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

// --- Per-workspace Editor panel (self-contained state) ---

function WorkspaceEditor({ ftm, sftpId }: { ftm: FileTabManager; sftpId: string | null }) {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [active, setActive] = useState<FileTab | null>(null);
  const [mdPreview, setMdPreview] = useState(false);

  useEffect(() => {
    const sync = () => {
      setTabs([...ftm.getTabs()]);
      setActive(ftm.getActiveTab());
    };
    ftm.setOnChange(sync);
    sync();
    return () => ftm.setOnChange(() => {});
  }, [ftm]);

  // Reset preview mode when switching files
  useEffect(() => { setMdPreview(false); }, [active?.id]);

  const isMd = active?.type === 'markdown';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <EditorTabs
            tabs={tabs}
            activeTabId={active?.id ?? null}
            onSelect={(id) => ftm.setActiveTab(id)}
            onClose={(id) => ftm.closeTab(id)}
          />
        </div>
        {isMd && active?.content != null && (
          <button
            onClick={() => setMdPreview((v) => !v)}
            style={{
              background: 'none', border: 'none', color: mdPreview ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700, padding: '6px 10px', cursor: 'pointer', flexShrink: 0,
              letterSpacing: 0.5,
            }}
          >
            {mdPreview ? 'EDIT' : 'PREVIEW'}
          </button>
        )}
      </div>
      {active?.content != null ? (
        isMd && mdPreview ? (
          <MarkdownPreview content={active.content} visible={true} />
        ) : (
          <CodeEditor
            content={active.content}
            fileName={active.fileName}
            visible={true}
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
    </>
  );
}

// --- Main App ---

export function App() {
  const keyboardHeight = useKeyboardHeight();
  const [screen, setScreen] = useState<Screen>('workspace-list');
  const [activeTab, setActiveTab] = useState<string>('terminal');
  const [debugEnabled, setDebugEnabled] = useState(() => localStorage.getItem('intode_debug') === 'true');

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

  const getFileTabMgr = useCallback((wsId: string): FileTabManager => {
    let mgr = ftmRef.current.get(wsId);
    if (!mgr) {
      mgr = new FileTabManager();
      ftmRef.current.set(wsId, mgr);
    }
    return mgr;
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
      setActiveTab('terminal');
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
          const password = await getWorkspaceStore().getPassword(conn.wsId);
          const { sessionId } = await Ssh.connect({
            host: conn.workspace.host,
            port: conn.workspace.port,
            username: conn.workspace.username,
            password: password ?? undefined,
          });
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
          <DebugOverlay enabled={debugEnabled} />
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
          <button onClick={handleDisconnect} style={styles.disconnectBtn}>
            HALT_SESSION
          </button>
        </div>

        <div style={styles.content}>
          {connections.map((conn) => {
            const isActive = conn.wsId === activeWsId;
            const ftm = getFileTabMgr(conn.wsId);
            return (
              <React.Fragment key={conn.wsId}>
                {/* Files — per workspace, always mounted */}
                <div style={{ ...styles.tabContent, display: isActive && activeTab === 'files' ? 'flex' : 'none' }}>
                  {conn.sftpId ? (
                    <FileTree
                      sftpId={conn.sftpId}
                      rootPath={conn.workspace.defaultPath}
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

                {/* Editor — per workspace, always mounted */}
                <div
                  style={{
                    ...styles.tabContent,
                    display: isActive && activeTab === 'editor' ? 'flex' : 'none',
                    flexDirection: 'column',
                  }}
                >
                  <WorkspaceEditor ftm={ftm} sftpId={conn.sftpId} />
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
          {/* Settings tab */}
          <div style={{ ...styles.tabContent, display: activeTab === 'settings' ? 'flex' : 'none' }}>
            <SettingsScreen
              appVersion={APP_VERSION}
              buildNumber={BUILD_NUMBER}
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
            context={activeTab === 'terminal' ? 'terminal' : 'code-editor'}
            onKeyPress={(data) => {
              if (activeTab === 'terminal') {
                // Send directly to SSH (bypasses xterm paste bracketing)
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
                else editor.insertText(data);
              }
            }}
          />
        )}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} extraTabs={getExtraTabs()} />
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
};
