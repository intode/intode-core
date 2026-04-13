import React, { useState, useEffect, useRef } from 'react';

interface Props {
  initialName: string;
  title?: string;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ initialName, title = 'Rename', onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      // Select stem (before last dot) for easier editing
      const input = inputRef.current;
      if (input) {
        const dot = initialName.lastIndexOf('.');
        if (dot > 0) input.setSelectionRange(0, dot);
        else input.select();
      }
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const disabled = name.trim().length === 0 || name === initialName || name.includes('/');

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002 }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'fixed',
          left: 24,
          right: 24,
          top: '35%',
          zIndex: 10003,
          background: 'var(--bg-elevated, #151a1f)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          padding: 16,
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) onSubmit(name.trim());
            if (e.key === 'Escape') onCancel();
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 10px',
            fontSize: 14,
            background: 'var(--bg-base, #0a0e13)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 4,
              padding: '6px 14px',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => !disabled && onSubmit(name.trim())}
            disabled={disabled}
            style={{
              background: disabled ? 'transparent' : 'var(--accent-green, #00ff66)',
              border: '1px solid var(--accent-green, #00ff66)',
              color: disabled ? 'var(--text-tertiary)' : 'var(--bg-base, #0a0e13)',
              borderRadius: 4,
              padding: '6px 14px',
              fontSize: 13,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Rename
          </button>
        </div>
      </div>
    </>
  );
}
