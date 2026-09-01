import React from 'react';
import { getSshCapabilities } from '../ssh/capabilities';

interface Props {
  count: number;
  scanning: boolean;
  onCancel: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function SelectionActionBar({ count, scanning, onCancel, onDownload, onCopy, onMove, onDelete }: Props) {
  // Same rule as the action sheet: an action this runtime cannot perform is not
  // offered. The bar keeps Cancel so a selection is never a trap.
  const { fileOps, fileTransfer } = getSshCapabilities();
  const disabled = count === 0 || scanning;
  const btnStyle = (variant: 'default' | 'danger' = 'default'): React.CSSProperties => ({
    background: disabled
      ? 'transparent'
      : variant === 'danger'
        ? 'var(--accent-red, #ff6b6b)'
        : 'var(--accent-blue, #4a9eff)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
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
      {fileTransfer && (
        <button onClick={onDownload} disabled={disabled} style={btnStyle()} aria-label="Download">
          ⬇
        </button>
      )}
      {fileOps && (
        <>
          <button onClick={onCopy} disabled={disabled} style={btnStyle()} aria-label="Copy">
            ⎘
          </button>
          <button onClick={onMove} disabled={disabled} style={btnStyle()} aria-label="Move">
            ↪
          </button>
          <button onClick={onDelete} disabled={disabled} style={btnStyle('danger')} aria-label="Delete">
            🗑
          </button>
        </>
      )}
    </div>
  );
}
