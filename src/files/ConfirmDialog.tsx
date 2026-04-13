import React from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', destructive, onConfirm, onCancel }: Props) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002 }} onClick={onCancel} />
      <div style={{
        position: 'fixed', left: 24, right: 24, top: '40%', zIndex: 10003,
        background: 'var(--bg-elevated, #151a1f)', borderRadius: 8, border: '1px solid var(--border-subtle)',
        padding: 16, color: 'var(--text-primary)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'transparent', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', borderRadius: 4, padding: '6px 14px', fontSize: 13,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            background: destructive ? 'var(--accent-red, #ff4444)' : 'var(--accent-green, #00ff66)',
            border: 'none',
            color: destructive ? '#fff' : 'var(--bg-base, #0a0e13)',
            borderRadius: 4, padding: '6px 14px', fontSize: 13,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}
