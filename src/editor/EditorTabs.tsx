import React from 'react';
import { FileTab } from '../files/TabManager';

export interface EditorTabsProps {
  tabs: FileTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function EditorTabs({ tabs, activeTabId, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div style={styles.bar}>
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              ...styles.tab,
              backgroundColor: active ? 'var(--bg-base)' : 'var(--bg-crust)',
              borderBottomColor: active ? 'var(--accent-blue)' : 'transparent',
            }}
          >
            <span style={{
              ...styles.tabName,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              {tab.fileName}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              style={styles.closeBtn}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    overflowX: 'auto',
    backgroundColor: 'var(--bg-crust)',
    borderBottom: '1px solid var(--bg-surface0)',
    flexShrink: 0,
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    flexShrink: 0,
    borderBottom: '2px solid transparent',
    WebkitTapHighlightColor: 'transparent',
  },
  tabName: {
    fontSize: 13,
    whiteSpace: 'nowrap',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 11,
    padding: '2px 4px',
    cursor: 'pointer',
    borderRadius: 4,
    lineHeight: 1,
  },
};
