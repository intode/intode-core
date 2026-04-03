// App
export { App } from './app/App';
export { TabBar } from './app/TabBar';
export type { TabId } from './app/TabBar';

// Policy
export type { AppPolicy, LimitHandler } from './policies/types';
export { DEFAULT_POLICY } from './policies/types';
export { setPolicy, getPolicy, setLimitHandler, checkLimit } from './policies/provider';

// Tab Registry (Pro can inject custom tabs)
export type { TabDefinition, TabRenderer } from './app/tab-registry';
export { registerTab, getExtraTabs, getTabRenderer } from './app/tab-registry';

// Session hooks (Pro can inject save/restore)
export { setSessionSaveHook, setSessionLoadHook, saveSessionState, loadSessionState } from './app/session-hooks';
export type { SessionData } from './app/session-hooks';

// Settings Registry (Pro can inject settings pages)
export type { SettingsMenuItem, SettingsPageComponent } from './app/settings-registry';
export { registerSettingsPage, getSettingsMenuItems, getSettingsPage } from './app/settings-registry';

// Plugins
export type { MarkdownPlugin, EditorPlugin } from './plugins/types';
export {
  registerMarkdownPlugin,
  getMarkdownPlugins,
  getPluginForLang,
  registerEditorPlugin,
  getEditorPlugins,
} from './plugins/registry';

// SSH
export { Ssh } from './ssh/index';
export type { SshPlugin, ConnectOptions, ConnectionStatus, SftpEntry, SftpStat, SshKey } from './ssh/index';

// Workspace
export type { Workspace, CreateWorkspaceData, WorkspaceStore } from './workspace/WorkspaceManager';
export { setWorkspaceStore, getWorkspaceStore, createWorkspace } from './workspace/WorkspaceManager';

// Terminal
export { TerminalManager } from './terminal/TerminalManager';
export { TerminalView } from './terminal/TerminalView';

// Files
export { FileTree } from './files/FileTree';
export { FileTabManager, detectFileType } from './files/TabManager';

// Editor
export { CodeEditor, CodeEditor as CodeViewer, getActiveEditorApi } from './editor/CodeEditor';
export type { CodeEditorRef } from './editor/CodeEditor';

// Markdown
export { MarkdownPreview } from './md-preview/MarkdownPreview';
export { renderMarkdown } from './md-preview/pipeline';
export { registerRemarkPlugin, registerRehypePlugin, registerPostProcessor } from './md-preview/pipeline-extensions';

// Extra Keys
export { ExtraKeyBar } from './extra-keys/ExtraKeyBar';

// Gestures
export { PinchZoom } from './gestures/PinchZoom';

// Themes
export { DARK_THEME, applyTheme } from './themes/dark';
export { LIGHT_THEME } from './themes/light';
export { initTheme, setThemeMode, getThemeMode, getXtermTheme, onThemeChange } from './themes/theme-manager';
export type { ThemeMode } from './themes/theme-manager';
