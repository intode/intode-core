import React, { useEffect, useState } from 'react';
import { subscribeNotices, dismissNotice, type Notice } from './notice';

/** Errors stay until dismissed; informational notices fade on their own. */
const INFO_TIMEOUT_MS = 4000;

/**
 * Renders whatever `notify()` posted. Mounted once, next to the transfer
 * snackbar, so it sits above the tab bar and below any modal.
 *
 * Deliberately not a dialog: an alert blocks the JS thread, which on iOS also
 * freezes anything driving the app, and it cannot show more than one failure.
 */
export function Toaster() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => subscribeNotices(setNotices), []);

  useEffect(() => {
    const timers = notices
      .filter((n) => n.kind === 'info')
      .map((n) => window.setTimeout(() => dismissNotice(n.id), INFO_TIMEOUT_MS));
    return () => timers.forEach(window.clearTimeout);
  }, [notices]);

  if (notices.length === 0) return null;

  return (
    <div style={s.stack}>
      {notices.map((n) => (
        <div key={n.id} style={{ ...s.card, borderColor: n.kind === 'error' ? 'var(--accent-red)' : 'var(--bg-surface1)' }}>
          <div style={s.body}>
            <div style={s.title}>{n.title}</div>
            {n.detail && <div style={s.detail}>{n.detail}</div>}
          </div>
          <button onClick={() => dismissNotice(n.id)} style={s.close} aria-label="Dismiss">
            {'×'}
          </button>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  stack: {
    position: 'fixed',
    left: 12,
    right: 12,
    bottom: 64,
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    pointerEvents: 'none',
  },
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--bg-surface1)',
    backgroundColor: 'var(--bg-elevated, #151a1f)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    color: 'var(--text-primary)',
    fontSize: 13,
    pointerEvents: 'auto',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: 500, lineHeight: 1.35 },
  detail: {
    marginTop: 2,
    color: 'var(--text-secondary)',
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  close: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 18,
    lineHeight: 1,
    padding: '0 4px',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
