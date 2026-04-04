/** DI hooks for session save/restore — Pro injects these at bootstrap */

export interface SessionData {
  workspaceId: string;
  activeTab: string;
  openFiles?: string[];        // file paths
  activeFile?: string;         // active file path
  terminalTabIds?: string[];   // terminal tab IDs (for tmux reattach)
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
