// App
export { App } from './app/App';
export { TabBar } from './app/TabBar';
export type { TabId } from './app/TabBar';

// Policy
export type { AppPolicy, LimitHandler } from './policies/types';
export { DEFAULT_POLICY } from './policies/types';
export { setPolicy, getPolicy, setLimitHandler, checkLimit } from './policies/provider';

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
export type { SshPlugin, ConnectOptions, ConnectionStatus, SftpEntry, SftpStat } from './ssh/index';

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
export { CodeViewer } from './editor/CodeViewer';

// Markdown
export { MarkdownPreview } from './md-preview/MarkdownPreview';
export { renderMarkdown } from './md-preview/pipeline';

// Extra Keys
export { ExtraKeyBar } from './extra-keys/ExtraKeyBar';

// Gestures
export { PinchZoom } from './gestures/PinchZoom';

// Themes
export { DARK_THEME, applyTheme } from './themes/dark';
