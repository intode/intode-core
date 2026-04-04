import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getPolicy, checkLimit } from '../policies/provider';
import { TerminalView } from './TerminalView';

interface Tab {
  id: string;
  label: string;
}

export interface TerminalTabsProps {
  sessionId: string;
  defaultPath?: string;
  visible: boolean;
  initialTabIds?: string[];
}

export function TerminalTabs({ sessionId, defaultPath, visible, initialTabIds }: TerminalTabsProps) {
  const nextLabel = useRef(2);
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (initialTabIds && initialTabIds.length > 0) {
      nextLabel.current = initialTabIds.length + 1;
      return initialTabIds.map((id, i) => ({ id, label: String(i + 1) }));
    }
    return [{ id: crypto.randomUUID(), label: '1' }];
  });
  const [activeId, setActiveId] = useState(tabs[0].id);

  // Expose current tab IDs for session save
  useEffect(() => {
    (window as any).__intodeTerminalTabIds = tabs.map((t) => t.id);
    return () => { delete (window as any).__intodeTerminalTabIds; };
  }, [tabs]);

  const addTab = useCallback(() => {
    const { maxTerminals } = getPolicy();
    if (!checkLimit('terminals', tabs.length, maxTerminals)) return;
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
          setActiveId(next[newIdx].id);
        }
        return next;
      });
    },
    [activeId],
  );

  return (
    <div style={rootStyle}>
      <div style={barStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-terminal-tab
            onClick={() => setActiveId(tab.id)}
            style={{ ...tabStyle, ...(tab.id === activeId ? activeTabStyle : {}) }}
          >
            <span>Terminal {tab.label}</span>
            {tabs.length > 1 && (
              <span
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
      </div>

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
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
};

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--bg-mantle)',
  borderBottom: '1px solid var(--bg-surface0)',
  flexShrink: 0,
  height: 32,
  overflowX: 'auto',
  paddingLeft: 4,
};

const tabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 10px',
  height: 32,
  fontSize: 12,
  fontWeight: 500,
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  borderBottom: '2px solid transparent',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  transition: 'color 150ms ease',
};

const activeTabStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  borderBottomColor: 'var(--accent-blue)',
};

const closeStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.4,
  padding: '0 2px',
};

const addStyle: React.CSSProperties = {
  padding: '0 12px',
  height: 32,
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
