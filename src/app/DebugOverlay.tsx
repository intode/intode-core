import React, { useState, useEffect, useRef } from 'react';
import { getDebugLogs, setDebugLogListener } from '../lib/debug-log';

export interface DebugOverlayProps {
  enabled: boolean;
}

export function DebugOverlay({ enabled }: DebugOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState(getDebugLogs());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDebugLogListener(() => {
      setLogs([...getDebugLogs()]);
    });
    return () => setDebugLogListener(null);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => setVisible(v => !v)}
        style={{
          position: 'fixed', bottom: 64, left: 8, zIndex: 999,
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: visible ? 'var(--accent-red)' : 'var(--bg-surface1)',
          color: 'var(--text-primary)', border: 'none', fontSize: 14,
          opacity: 0.7,
        }}
      >
        D
      </button>
      {visible && (
        <div
          ref={scrollRef}
          style={{
            position: 'fixed', bottom: 100, left: 8, right: 8,
            maxHeight: '40vh', zIndex: 998,
            backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 8,
            padding: 8, overflowY: 'auto', fontSize: 11,
            fontFamily: 'monospace', color: 'var(--accent-green)',
          }}
        >
          {logs.map((l, i) => (
            <div key={i} style={{ marginBottom: 2, wordBreak: 'break-all' }}>
              <span style={{ color: 'var(--text-muted)' }}>{l.time}</span> {l.msg}
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No logs yet</div>}
        </div>
      )}
    </>
  );
}
