import React from 'react';

interface Props {
  count: number;
  scanning: boolean;
  onCancel: () => void;
  onDownload: () => void;
}

export function SelectionActionBar({ count, scanning, onCancel, onDownload }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--accent-blue-dim, #1a2a3a)',
        color: 'var(--accent-blue, #4a9eff)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      <button
        onClick={onCancel}
        aria-label="Cancel selection"
        style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 16, cursor: 'pointer', padding: '4px 8px' }}
      >
        ✕
      </button>
      <span style={{ flex: 1 }}>
        {scanning ? 'Scanning…' : `${count} selected`}
      </span>
      <button
        onClick={onDownload}
        disabled={count === 0 || scanning}
        style={{
          background: count === 0 || scanning ? 'transparent' : 'var(--accent-blue, #4a9eff)',
          color: count === 0 || scanning ? 'var(--text-muted)' : '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '4px 12px',
          fontSize: 12,
          cursor: count === 0 || scanning ? 'default' : 'pointer',
        }}
      >
        ⬇ Download
      </button>
    </div>
  );
}
