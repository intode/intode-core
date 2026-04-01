import React from 'react';

export type TabId = 'files' | 'editor' | 'terminal';

export interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'files', label: 'Files', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { id: 'editor', label: 'Editor', icon: 'M13.325 3.05L8.667 20.432l1.932.518 4.658-17.382-1.932-.518zM7.612 18.361l1.377-1.377-4.97-4.97 4.97-4.97-1.377-1.377L1.28 12.014l6.332 6.347zM16.388 5.667l-1.377 1.377 4.97 4.97-4.97 4.97 1.377 1.377 6.332-6.347-6.332-6.347z' },
  { id: 'terminal', label: 'Terminal', icon: 'M4 17l6-5-6-5M12 19h8' },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav style={styles.nav}>
      {TABS.map(({ id, label, icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            style={{
              ...styles.button,
              color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={icon} />
            </svg>
            <span style={styles.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 56,
    backgroundColor: 'var(--bg-mantle)',
    borderTop: '1px solid var(--bg-surface0)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    flexShrink: 0,
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flex: 1,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '6px 0',
    WebkitTapHighlightColor: 'transparent',
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
  },
};
