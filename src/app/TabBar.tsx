import React from 'react';
import type { TabDefinition } from './tab-registry';

export type TabId = 'files' | 'editor' | 'terminal' | 'settings' | (string & {});

export interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  extraTabs?: TabDefinition[];
}

const CORE_TABS: TabDefinition[] = [
  { id: 'files', label: 'Files', order: 0, icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { id: 'editor', label: 'Editor', order: 10, icon: 'M13.325 3.05L8.667 20.432l1.932.518 4.658-17.382-1.932-.518zM7.612 18.361l1.377-1.377-4.97-4.97 4.97-4.97-1.377-1.377L1.28 12.014l6.332 6.347zM16.388 5.667l-1.377 1.377 4.97 4.97-4.97 4.97 1.377 1.377 6.332-6.347-6.332-6.347z' },
  { id: 'terminal', label: 'Terminal', order: 20, icon: 'M4 17l6-5-6-5M12 19h8' },
];

const SETTINGS_TAB: TabDefinition = {
  id: 'settings',
  label: 'Settings',
  order: 90,
  icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2zM12 15a3 3 0 100-6 3 3 0 000 6z',
};

export function TabBar({ activeTab, onTabChange, extraTabs = [] }: TabBarProps) {
  const allTabs = [...CORE_TABS, ...extraTabs, SETTINGS_TAB]
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

  return (
    <nav style={styles.nav}>
      {allTabs.map(({ id, label, icon }) => {
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
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
};
