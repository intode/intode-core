/**
 * Single source of truth for the currently active native terminal id.
 *
 * Owned exclusively by TerminalTabs (the parent that holds activeId React state).
 * Readers: handleKeyPress (input routing), ExtraKeyBar (Ctrl toggle target),
 * pro/bootstrap overlay hooks (hide/restore target).
 */

type Listener = (id: string | null) => void;

let activeId: string | null = null;
const listeners = new Set<Listener>();

export function setActiveNativeTerminal(id: string | null): void {
  if (activeId === id) return;
  activeId = id;
  listeners.forEach((cb) => {
    try { cb(id); } catch { /* isolate listeners from each other */ }
  });
}

export function getActiveNativeTerminal(): string | null {
  return activeId;
}

export function subscribeActiveNativeTerminal(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
