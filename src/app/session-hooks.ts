/** DI hooks for session save/restore — Pro injects these at bootstrap */

export interface FileTabState {
  path: string;
  scrollLine?: number;
  unsavedContent?: string;
}

export interface SessionData {
  workspaceId: string;
  activeTab: string;
  fileSubTab?: string;
  openFiles?: FileTabState[];
  activeFile?: string;
  expandedFolders?: string[];
  terminalTabIds?: string[];
  previewUrl?: string;
  /**
   * `false` when the user ended the session themselves (HALT_SESSION). The next launch then
   * starts at the workspace list instead of reconnecting.
   *
   * Absent means resume — automatic saves (backgrounding, tab switches) never set it. Without
   * this, halting saved the workspace id like any other save and the next launch reconnected
   * straight away, so a restored session could not be left closed short of deleting the
   * workspace: it came back on every launch, along with anything the host keeps running while
   * a session is live (such as a background keep-alive service).
   */
  resumeOnLaunch?: boolean;
}

type SaveFn = (data: SessionData) => void;
type LoadFn = () => SessionData | null;

let saveFn: SaveFn | null = null;
let loadFn: LoadFn | null = null;

export function setSessionSaveHook(fn: SaveFn): void { saveFn = fn; }
export function setSessionLoadHook(fn: LoadFn): void { loadFn = fn; }

export function saveSessionState(data: SessionData): void {
  saveFn?.(data);
}

export function loadSessionState(): SessionData | null {
  return loadFn?.() ?? null;
}

/** The workspace to reconnect to on launch, or `null` to start at the workspace list. */
export function launchResumeWorkspaceId(saved: SessionData | null): string | null {
  if (!saved?.workspaceId) return null;
  if (saved.resumeOnLaunch === false) return null;
  return saved.workspaceId;
}

/**
 * The saved session with auto-resume turned off, if it belongs to the workspace that was just
 * disconnected; `null` when there is nothing to change. Disconnecting from the workspace list
 * means the same as HALT_SESSION: the next launch must not reconnect it.
 */
export function haltedSessionFor(saved: SessionData | null, wsId: string): SessionData | null {
  if (!saved || saved.workspaceId !== wsId) return null;
  return { ...saved, resumeOnLaunch: false };
}
