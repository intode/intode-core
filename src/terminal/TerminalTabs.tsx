import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getPolicy, checkLimit } from '../policies/provider';
import { TerminalView } from './TerminalView';
import { getNativeTerminalProvider } from './terminal-provider';
import { setActiveNativeTerminal } from './active-terminal';
import { canRestoreTerminalTabs, canConfigureTmux } from './terminal-tab-hooks';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PromptDialog } from '../ui/PromptDialog';
import { useTabDragReorder } from './useTabDragReorder';
import { tabVisualStyle, tabStripStyle } from './tab-styles';
import { getSshCapabilities } from '../ssh/capabilities';

interface Tab {
  id: string;
  label: string;
  tmuxSession?: string;
}

const STORAGE_PREFIX = 'intode_termtabs_';

function saveTabs(wsId: string, tabs: Tab[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + wsId, JSON.stringify(tabs));
  } catch { /* */ }
}

function loadTabs(wsId: string): Tab[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + wsId);
    if (!raw) return null;
    const tabs = JSON.parse(raw) as Tab[];
    return tabs.length > 0 ? tabs : null;
  } catch { return null; }
}

export interface TerminalTabsProps {
  sessionId: string;
  wsId: string;
  defaultPath?: string;
  visible: boolean;
  /** Passed through to every tab's disconnected banner. */
  onReconnect?: () => Promise<void>;
}

export function TerminalTabs({ sessionId, wsId, defaultPath, visible, onReconnect }: TerminalTabsProps) {
  const nextLabel = useRef(2);
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (canRestoreTerminalTabs()) {
      const saved = loadTabs(wsId);
      if (saved && saved.length > 0) {
        nextLabel.current = saved.length + 1;
        return saved;
      }
    }
    return [{ id: crypto.randomUUID(), label: '1' }];
  });
  const [activeId, setActiveId] = useState(tabs[0].id);
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const tabsRef = useRef(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  const [bounceDir, setBounceDir] = useState<'next' | 'prev' | null>(null);
  const bounceTimerRef = useRef<number | null>(null);
  const [tmuxTarget, setTmuxTarget] = useState<{ id: string; initial: string } | null>(null);
  useEffect(() => () => {
    if (bounceTimerRef.current !== null) window.clearTimeout(bounceTimerRef.current);
  }, []);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    saveTabs(wsId, tabs);
    // Also expose for legacy session-hooks
    (window as any).__intodeTerminalTabIds = tabs.map((t) => t.id);
    return () => { delete (window as any).__intodeTerminalTabIds; };
  }, [tabs, wsId]);

  // Sync active native terminal id — single owner of this global state.
  // Only the workspace whose terminal tab is currently visible should claim ownership.
  // Otherwise, with multiple workspaces connected, every TerminalTabs calls
  // setActiveNativeTerminal on mount and the last write wins — which means overlay
  // hooks save the wrong terminal id and later restore a terminal from the inactive
  // workspace, overlapping native views from different workspaces.
  useEffect(() => {
    const provider = getNativeTerminalProvider();
    if (!provider?.isAvailable()) return;
    if (!visible) return;
    setActiveNativeTerminal(activeId);
    return () => setActiveNativeTerminal(null);
  }, [activeId, visible]);

  const addTab = useCallback(async () => {
    const { maxTerminals } = getPolicy();
    if (!(await checkLimit('terminals', tabs.length, maxTerminals))) return;
    const id = crypto.randomUUID();
    const label = String(nextLabel.current++);
    setTabs((t) => [...t, { id, label }]);
    setActiveId(id);
  }, [tabs.length]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (activeId === id) {
          const newIdx = Math.min(idx, next.length - 1);
          const newId = next[newIdx].id;
          setActiveId(newId);
        }
        return next;
      });
    },
    [activeId],
  );

  const configureTmux = useCallback((id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    setTmuxTarget({ id, initial: tab.tmuxSession || '' });
  }, [tabs]);

  const applyTmux = useCallback((id: string, rawName: string) => {
    const name = rawName.trim();
    if (name && !canConfigureTmux()) return;
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, tmuxSession: name || undefined } : t));
    if (name) {
      const provider = getNativeTerminalProvider();
      provider?.writeInput(id, `tmux new-session -A -s ${name}\n`).catch(() => {});
    }
  }, []);

  const barRef = useRef<HTMLDivElement | null>(null);
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const measureWidths = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return [];
    return Array.from(bar.querySelectorAll<HTMLElement>('[data-terminal-tab]'))
      .map((el) => el.offsetWidth);
  }, []);

  const reorderTabs = useCallback((ids: string[]) => {
    setTabs((prev) => {
      if (ids.length !== prev.length) return prev;
      const next = ids.map((id) => prev.find((t) => t.id === id));
      return next.every((t): t is Tab => t !== undefined) ? next : prev;
    });
  }, []);

  const drag = useTabDragReorder({
    ids: tabIds,
    measureWidths,
    onReorder: reorderTabs,
    onLongPressTap: configureTmux,
    barRef,
  });

  const triggerBounce = useCallback((dir: 'next' | 'prev') => {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    setBounceDir(dir);
    if (bounceTimerRef.current !== null) {
      window.clearTimeout(bounceTimerRef.current);
    }
    bounceTimerRef.current = window.setTimeout(() => {
      setBounceDir(null);
      bounceTimerRef.current = null;
    }, 220);
  }, []);

  const handleSwipe = useCallback((direction: 'next' | 'prev', terminalId: string) => {
    if (terminalId !== activeIdRef.current) return;
    const current = tabsRef.current;
    const idx = current.findIndex((t) => t.id === activeIdRef.current);
    if (idx < 0) return;
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= current.length) {
      triggerBounce(direction);
      return;
    }
    const nextId = current[nextIdx].id;
    setActiveId(nextId);
  }, [triggerBounce]);

  useEffect(() => {
    const provider = getNativeTerminalProvider();
    if (!provider?.isAvailable() || !provider.addSwipeListener) return;
    let handle: { remove(): void } | null = null;
    let cancelled = false;
    provider.addSwipeListener((e) => handleSwipe(e.direction, e.terminalId))
      .then((h) => {
        if (cancelled) { h.remove(); return; }
        handle = h;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [handleSwipe]);

  // Without a shell channel every tab opens onto the same "not available" notice, so the
  // strip only offers ways to reach it again. Hide the whole control surface and let the
  // single view state the reason. This is a platform fact, never a paid gate — do not
  // offer an upgrade here.
  const hasShell = getSshCapabilities().shell;

  return (
    <div style={rootStyle}>
      {hasShell && <div ref={barRef} className="tab-strip" style={{
        ...tabStripStyle,
        transform: bounceDir === 'next' ? 'translateX(-12px)'
                 : bounceDir === 'prev' ? 'translateX(12px)' : 'translateX(0)',
        transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-terminal-tab
            onClick={() => {
              if (drag.shouldSuppressClick()) return;
              setActiveId(tab.id);
            }}
            {...drag.bind(tab.id)}
            style={tabVisualStyle({
              active: tab.id === activeId,
              dragging: tab.id === drag.draggingId,
              dragOffset: drag.dragOffset,
            })}
          >
            <span>{tab.tmuxSession ? `tmux:${tab.tmuxSession}` : `Terminal ${tab.label}`}</span>
            {tabs.length > 1 && (
              <span
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                style={closeStyle}
              >
                {'\u00d7'}
              </span>
            )}
          </button>
        ))}
        <button onClick={addTab} style={addStyle}>
          +
        </button>
      </div>}

      <div style={bodyStyle}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: tab.id === activeId ? 'flex' : 'none',
            }}
          >
            <TerminalView
              sessionId={sessionId}
              defaultPath={defaultPath}
              terminalId={tab.id}
              visible={visible && tab.id === activeId}
              tmuxSession={tab.tmuxSession}
              onReconnect={onReconnect}
            />
          </div>
        ))}
      </div>
      {tmuxTarget && (
        <PromptDialog
          title="tmux session name"
          initialValue={tmuxTarget.initial}
          placeholder="empty to disable"
          submitLabel="OK"
          validate={(v) => v !== tmuxTarget.initial}
          onSubmit={(name) => {
            applyTmux(tmuxTarget.id, name);
            setTmuxTarget(null);
          }}
          onCancel={() => setTmuxTarget(null)}
        />
      )}
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
};

const closeStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.4,
  padding: '0 2px',
};

const addStyle: React.CSSProperties = {
  padding: '0 12px',
  // Matches the tabs: a fixed 32px overhangs the strip's 31px content box and
  // leaves it with vertical overflow it has no use for.
  height: '100%',
  fontSize: 14,
  color: 'var(--text-tertiary)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
};
