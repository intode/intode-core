import React from 'react';

export interface ConflictBarProps {
  onReload: () => void;
  onKeepMine: () => void;
}

export function ConflictBar({ onReload, onKeepMine }: ConflictBarProps) {
  return (
    <div style={styles.bar}>
      <span style={styles.text}>File changed externally</span>
      <div style={styles.actions}>
        <button onClick={onReload} style={styles.reloadBtn}>Reload</button>
        <button onClick={onKeepMine} style={styles.keepBtn}>Keep Mine</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-surface0)',
    borderBottom: '1px solid var(--accent-yellow)',
    flexShrink: 0,
  },
  text: {
    fontSize: 12,
    color: 'var(--accent-yellow)',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  reloadBtn: {
    fontSize: 11,
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    backgroundColor: 'var(--accent-blue)',
    color: 'var(--bg-base)',
    fontWeight: 600,
  },
  keepBtn: {
    fontSize: 11,
    padding: '3px 10px',
    border: '1px solid var(--text-muted)',
    borderRadius: 4,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
};
