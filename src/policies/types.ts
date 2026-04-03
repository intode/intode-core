export interface AppPolicy {
  // === Numeric limits (injected via DI) ===
  maxProjects: number;
  maxTerminals: number;
  maxFileTabs: number;

  // === Feature flags (Pro plugin activation) ===
  canEdit: boolean;
  canSplitView: boolean;
  canBackgroundKeepAlive: boolean;
  canSessionRestore: boolean;
  canPortForward: boolean;
  canJumpHost: boolean;
  canGrep: boolean;
  canGit: boolean;
  canCustomTheme: boolean;
  canCustomKeys: boolean;
  canSnippets: boolean;
  canDebugConsole: boolean;
  mdRenderers: string[];

  // === UI config (injectable by Pro) ===
  showDebugToggle: boolean;
}

export const DEFAULT_POLICY: AppPolicy = {
  maxProjects: Infinity,
  maxTerminals: Infinity,
  maxFileTabs: Infinity,
  canEdit: true,
  canSplitView: false,
  canBackgroundKeepAlive: false,
  canSessionRestore: false,
  canPortForward: false,
  canJumpHost: false,
  canGrep: false,
  canGit: false,
  canCustomTheme: false,
  canCustomKeys: false,
  canSnippets: false,
  canDebugConsole: false,
  mdRenderers: ['gfm'],
  showDebugToggle: true,
};

export type LimitHandler = (type: string, currentCount: number, max: number) => void;
