import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TabBar, TabId } from './TabBar';
import { WorkspaceListScreen } from '../workspace/WorkspaceListScreen';
import { WorkspaceAddScreen } from '../workspace/WorkspaceAddScreen';
import { WorkspaceDropdown } from '../workspace/WorkspaceDropdown';
import { ConnectingScreen } from '../workspace/ConnectingScreen';
import { SettingsScreen } from './SettingsScreen';
import { DebugOverlay } from './DebugOverlay';
import { FileTree } from '../files/FileTree';
import { CodeViewer } from '../editor/CodeViewer';
import { MarkdownPreview } from '../md-preview/MarkdownPreview';
import { EditorTabs } from '../editor/EditorTabs';
import { TerminalView } from '../terminal/TerminalView';
import { ExtraKeyBar } from '../extra-keys/ExtraKeyBar';
import { Ssh } from '../ssh/index';
import { createWorkspace, Workspace, CreateWorkspaceData } from '../workspace/WorkspaceManager';
import { detectFileType, FileTab, FileTabManager } from '../files/TabManager';
import { debugLog } from '../lib/debug-log';
import '../themes/dark.css';

type Screen = 'workspace-list' | 'workspace-add' | 'connecting' | 'workspace-view' | 'settings';

export const APP_VERSION = __APP_VERSION__;
export const BUILD_NUMBER = __BUILD_NUMBER__;

const fileTabManager = new FileTabManager();

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

export function App() {
  const keyboardHeight = useKeyboardHeight();
  const [screen, setScreen] = useState<Screen>('workspace-list');
  const [activeTab, setActiveTab] = useState<TabId>('terminal');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sftpId, setSftpId] = useState<string | null>(null);
  const [sftpError, setSftpError] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [listKey, setListKey] = useState(0);
  const [fileTabs, setFileTabs] = useState<FileTab[]>([]);
  const [activeFileTab, setActiveFileTab] = useState<FileTab | null>(null);
  const [addReturnTo, setAddReturnTo] = useState<'list' | 'view'>('list');
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // FileTabManager change listener
  useEffect(() => {
    fileTabManager.setOnChange(() => {
      setFileTabs([...fileTabManager.getTabs()]);
      setActiveFileTab(fileTabManager.getActiveTab());
    });
  }, []);

  // Auto-focus terminal on tab switch to show keyboard
  useEffect(() => {
    if (activeTab === 'terminal' && screen === 'workspace-view') {
      setTimeout(() => {
        const el = terminalContainerRef.current?.querySelector('textarea.xterm-helper-textarea');
        if (el instanceof HTMLTextAreaElement) el.focus();
      }, 100);
    }
  }, [activeTab, screen]);

  const handleSelectWorkspace = useCallback((ws: Workspace) => {
    setSelectedWorkspace(ws);
    setScreen('connecting');
  }, []);

  const handleConnected = useCallback(async (sid: string) => {
    debugLog(`Connected sessionId=${sid}`);
    setSessionId(sid);
    setSftpError(null);
    try {
      const { sftpId: id } = await Ssh.openSftp({ sessionId: sid });
      debugLog(`SFTP opened sftpId=${id}`);
      setSftpId(id);
    } catch (e) {
      debugLog(`SFTP error: ${e}`);
      setSftpError(String(e));
    }
    setScreen('workspace-view');
    setActiveTab('terminal');
  }, []);

  const handleSwitchWorkspace = useCallback(async (ws: Workspace) => {
    if (ws.id === selectedWorkspace?.id) return;
    // Disconnect current
    if (sessionId) {
      try {
        if (sftpId) await Ssh.closeSftp({ sftpId });
        await Ssh.disconnect({ sessionId });
      } catch { /* ignore */ }
    }
    setSessionId(null);
    setSftpId(null);
    setSftpError(null);
    for (const tab of fileTabManager.getTabs()) fileTabManager.closeTab(tab.id);
    // Connect to new
    setSelectedWorkspace(ws);
    setScreen('connecting');
  }, [sessionId, sftpId, selectedWorkspace]);

  const handleSaveWorkspace = useCallback(async (data: CreateWorkspaceData, password: string) => {
    let newWs: Workspace | null = null;
    if (editingWorkspace) {
      const store = (await import('../workspace/WorkspaceManager')).getWorkspaceStore();
      await store.update(editingWorkspace.id, data);
      if (password) await store.savePassword(editingWorkspace.id, password);
      setEditingWorkspace(null);
    } else {
      newWs = await createWorkspace(data, password);
    }
    setListKey(k => k + 1);

    if (addReturnTo === 'view' && newWs) {
      // Disconnect current and connect to newly created workspace
      if (sessionId) {
        try {
          if (sftpId) await Ssh.closeSftp({ sftpId });
          await Ssh.disconnect({ sessionId });
        } catch { /* ignore */ }
      }
      setSessionId(null);
      setSftpId(null);
      setSftpError(null);
      for (const tab of fileTabManager.getTabs()) fileTabManager.closeTab(tab.id);
      setSelectedWorkspace(newWs);
      setScreen('connecting');
    } else if (addReturnTo === 'view') {
      setScreen('workspace-view');
    } else {
      setScreen('workspace-list');
    }
  }, [editingWorkspace, addReturnTo, sessionId, sftpId]);

  const handleFileSelect = useCallback(async (path: string) => {
    if (!sftpId) return;
    const type = detectFileType(path.split('/').pop() ?? '');
    if (type === 'binary') return;

    await fileTabManager.openFile(sftpId, path);
    setActiveTab('editor');
  }, [sftpId]);

  const handleDisconnect = useCallback(async () => {
    if (sessionId) {
      try {
        if (sftpId) await Ssh.closeSftp({ sftpId });
        await Ssh.disconnect({ sessionId });
      } catch { /* ignore */ }
    }
    setSessionId(null);
    setSftpId(null);
    setSftpError(null);
    for (const tab of fileTabManager.getTabs()) fileTabManager.closeTab(tab.id);
    setScreen('workspace-list');
  }, [sessionId, sftpId]);

  // --- Settings ---
  if (screen === 'settings') {
    return (
      <div style={styles.safeArea}>
        <SettingsScreen appVersion={APP_VERSION} buildNumber={BUILD_NUMBER} onBack={() => setScreen('workspace-list')} />
        <DebugOverlay />
      </div>
    );
  }

  // --- Workspace list ---
  if (screen === 'workspace-list') {
    return (
      <div style={styles.safeArea}>
        <WorkspaceListScreen
          key={listKey}
          onSelectWorkspace={handleSelectWorkspace}
          onAddWorkspace={() => { setEditingWorkspace(null); setAddReturnTo('list'); setScreen('workspace-add'); }}
          onEditWorkspace={(ws) => { setEditingWorkspace(ws); setAddReturnTo('list'); setScreen('workspace-add'); }}
          onSettings={() => setScreen('settings')}
        />
        <DebugOverlay />
      </div>
    );
  }

  // --- Add/Edit workspace ---
  if (screen === 'workspace-add') {
    return (
      <div style={{ ...styles.safeArea, paddingBottom: keyboardHeight }}>
        <WorkspaceAddScreen
          onSave={handleSaveWorkspace}
          onCancel={() => {
            setEditingWorkspace(null);
            setScreen(addReturnTo === 'view' ? 'workspace-view' : 'workspace-list');
          }}
          editWorkspace={editingWorkspace ?? undefined}
        />
      </div>
    );
  }

  // --- Connecting ---
  if (screen === 'connecting' && selectedWorkspace) {
    return (
      <div style={styles.safeArea}>
        <ConnectingScreen
          workspace={selectedWorkspace}
          onConnected={handleConnected}
          onFailed={() => {}}
          onCancel={() => setScreen('workspace-list')}
        />
      </div>
    );
  }

  // --- Workspace view (3 tabs) ---
  return (
    <div style={{ ...styles.safeArea, paddingBottom: keyboardHeight }}>
      <div style={styles.container}>
        {/* Status bar */}
        <div style={styles.statusBar}>
          {selectedWorkspace && (
            <WorkspaceDropdown
              current={selectedWorkspace}
              onSwitch={handleSwitchWorkspace}
              onAdd={() => { setEditingWorkspace(null); setAddReturnTo('view'); setScreen('workspace-add'); }}
            />
          )}
          <span style={{ color: '#a6e3a1', fontSize: 10, flexShrink: 0 }}>{'\u25cf'}</span>
          <button onClick={handleDisconnect} style={styles.disconnectBtn}>Disconnect</button>
        </div>

        <div style={styles.content}>
          {/* Files tab — always mounted, toggled via display (state preserved) */}
          <div style={{ ...styles.tabContent, display: activeTab === 'files' ? 'flex' : 'none' }}>
            {sftpId && selectedWorkspace ? (
              <FileTree
                sftpId={sftpId}
                rootPath={selectedWorkspace.defaultPath}
                onFileSelect={handleFileSelect}
              />
            ) : sftpError ? (
              <div style={styles.placeholder}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--accent-red)', marginBottom: 8 }}>SFTP connection failed</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{sftpError}</p>
                </div>
              </div>
            ) : (
              <div style={styles.placeholder}>
                <span style={{ color: 'var(--text-muted)' }}>Connecting SFTP...</span>
              </div>
            )}
          </div>

          {/* Editor tab — always mounted, toggled via display */}
          <div style={{ ...styles.tabContent, display: activeTab === 'editor' ? 'flex' : 'none', flexDirection: 'column' }}>
            <EditorTabs
              tabs={fileTabs}
              activeTabId={activeFileTab?.id ?? null}
              onSelect={(id) => fileTabManager.setActiveTab(id)}
              onClose={(id) => fileTabManager.closeTab(id)}
            />
            {activeFileTab?.content != null ? (
              activeFileTab.type === 'markdown' ? (
                <MarkdownPreview content={activeFileTab.content} visible={true} />
              ) : (
                <CodeViewer content={activeFileTab.content} fileName={activeFileTab.fileName} visible={true} />
              )
            ) : activeFileTab?.isLoading ? (
              <div style={styles.placeholder}><span style={{ color: 'var(--text-muted)' }}>Loading...</span></div>
            ) : (
              <div style={styles.placeholder}><span style={{ color: 'var(--text-muted)' }}>Select a file</span></div>
            )}
          </div>

          {/* Terminal tab */}
          <div ref={terminalContainerRef} style={{ ...styles.tabContent, display: activeTab === 'terminal' ? 'flex' : 'none' }}>
            {sessionId && (
              <TerminalView sessionId={sessionId} visible={activeTab === 'terminal'} />
            )}
          </div>
        </div>

        {activeTab === 'terminal' && (
          <ExtraKeyBar context="terminal" onKeyPress={() => {}} />
        )}

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <DebugOverlay />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    padding: '8px 16px',
    backgroundColor: 'var(--bg-mantle)',
    borderBottom: '1px solid var(--bg-surface0)',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  },
  disconnectBtn: {
    background: 'none',
    border: '1px solid var(--bg-surface1)',
    borderRadius: 6,
    padding: '4px 10px',
    color: 'var(--text-muted)',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tabContent: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
