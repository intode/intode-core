import React, { useEffect, useState } from 'react';
import { getTransferManager } from './transfer-singleton';
import type { TransferState } from './TransferManager';

function formatBytes(n: number): string {
  if (n < 0) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function pickFeatured(states: TransferState[]): TransferState | null {
  const active = states.find((s) => s.phase === 'start' || s.phase === 'progress');
  if (active) return active;
  const recent = states.find(
    (s) =>
      (s.phase === 'done' || s.phase === 'error' || s.phase === 'cancelled') &&
      Date.now() - s.startedAt < 60_000,
  );
  return recent ?? null;
}

export function TransferSnackbar() {
  const [states, setStates] = useState<TransferState[]>([]);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const mgr = getTransferManager();
    return mgr.subscribe(setStates);
  }, []);

  const featured = pickFeatured(states);
  const activeCount = states.filter((s) => s.phase === 'start' || s.phase === 'progress').length;

  useEffect(() => {
    if (!featured) return;
    if (featured.phase !== 'done') return;
    const id = featured.id;
    const t = setTimeout(() => setDismissedId(id), 3000);
    return () => clearTimeout(t);
  }, [featured?.id, featured?.phase]);

  if (!featured || dismissedId === featured.id) return null;

  const pct =
    featured.totalBytes > 0
      ? Math.min(100, Math.round((featured.bytesTransferred / featured.totalBytes) * 100))
      : undefined;

  const title =
    activeCount > 1
      ? `${activeCount} transfers${pct !== undefined ? ` · ${pct}%` : ''}`
      : `${featured.kind === 'upload' ? 'Uploading' : 'Downloading'} ${featured.label}`;

  const sub =
    featured.phase === 'error'
      ? `Failed: ${featured.error ?? 'unknown error'}`
      : featured.phase === 'cancelled'
        ? 'Cancelled'
        : featured.phase === 'done'
          ? 'Done'
          : pct !== undefined
            ? `${pct}% · ${formatBytes(featured.bytesTransferred)} / ${formatBytes(featured.totalBytes)}`
            : formatBytes(featured.bytesTransferred);

  const canCancel = featured.phase === 'start' || featured.phase === 'progress';
  const canDismiss = !canCancel;

  const onCancel = () => {
    void getTransferManager().cancel(featured.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 64,
        zIndex: 9999,
        background: 'var(--bg-elevated, #151a1f)',
        border: '1px solid var(--border-subtle, #2a2f35)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 13,
        color: 'var(--text-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{sub}</div>
        {pct !== undefined && canCancel && (
          <div style={{ height: 2, background: 'var(--border-subtle, #2a2f35)', borderRadius: 1, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-green, #00ff66)' }} />
          </div>
        )}
      </div>
      {canCancel && (
        <button
          onClick={onCancel}
          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 4, padding: '4px 10px', fontSize: 12 }}
        >
          Cancel
        </button>
      )}
      {canDismiss && (
        <button
          onClick={() => setDismissedId(featured.id)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 18, padding: '0 6px' }}
        >
          ×
        </button>
      )}
    </div>
  );
}
