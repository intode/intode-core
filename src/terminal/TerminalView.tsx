import React, { useEffect, useRef } from 'react';
import { TerminalManager, TerminalSession } from './TerminalManager';
import { Ssh } from '../ssh/index';

export interface TerminalViewProps {
  sessionId: string;
  visible: boolean;
}

const manager = new TerminalManager();

export function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current || !sessionId) return;

    let cancelled = false;

    async function init() {
      const container = containerRef.current;
      if (!container) return;

      const session = await manager.createSession(sessionId);
      if (!session || cancelled) return;

      sessionRef.current = session;
      session.terminal.open(container);
      session.fitAddon.fit();

      const { cols, rows } = session.terminal;
      await manager.attachShell(session, sessionId, cols, rows);

      const observer = new ResizeObserver(() => {
        const s = sessionRef.current;
        if (!s) return;
        s.fitAddon.fit();
        Ssh.resizeShell({ channelId: s.channelId, cols: s.terminal.cols, rows: s.terminal.rows });
      });
      observer.observe(container);
      resizeObserverRef.current = observer;
    }

    init();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      if (sessionRef.current) {
        manager.destroySession(sessionRef.current.id);
        sessionRef.current = null;
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (sessionRef.current && visible) {
      sessionRef.current.fitAddon.fit();
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        backgroundColor: 'var(--term-bg)',
      }}
    />
  );
}

export { manager as terminalManager };
