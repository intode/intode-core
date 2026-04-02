import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalManager, TerminalSession } from './TerminalManager';
import { TerminalSelection } from './TerminalSelection';
import { Ssh } from '../ssh/index';
import { debugLog } from '../lib/debug-log';

export interface TerminalViewProps {
  sessionId: string;
  visible: boolean;
}

const manager = new TerminalManager();

export function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const selectionRef = useRef<TerminalSelection | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [showCopyBar, setShowCopyBar] = useState(false);

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

      // Touch selection
      const sel = new TerminalSelection(session.terminal, {
        onSelectionStart: () => setShowCopyBar(true),
        onSelectionChange: (has) => { if (!has) setShowCopyBar(false); },
      });
      sel.attach(container);
      selectionRef.current = sel;

      const { cols, rows } = session.terminal;
      await manager.attachShell(session, sessionId, cols, rows);

      const observer = new ResizeObserver(() => {
        const s = sessionRef.current;
        if (!s) return;
        s.fitAddon.fit();
        debugLog(`resize cols=${s.terminal.cols} rows=${s.terminal.rows}`);
        Ssh.resizeShell({ channelId: s.channelId, cols: s.terminal.cols, rows: s.terminal.rows });
      });
      observer.observe(container);
      resizeObserverRef.current = observer;
    }

    init();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      selectionRef.current?.dispose();
      selectionRef.current = null;
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

  const handleCopy = useCallback(() => {
    selectionRef.current?.copySelection();
    selectionRef.current?.clearSelection();
    setShowCopyBar(false);
  }, []);

  const handlePaste = useCallback(() => {
    selectionRef.current?.paste();
    selectionRef.current?.clearSelection();
    setShowCopyBar(false);
  }, []);

  const handleSelectAll = useCallback(() => {
    selectionRef.current?.selectAll();
  }, []);

  return (
    <div style={wrapperStyle}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--term-bg)',
        }}
      />
      {showCopyBar && (
        <div style={copyBarStyle}>
          <button onClick={handleCopy} style={btnStyle}>Copy</button>
          <div style={dividerStyle} />
          <button onClick={handlePaste} style={btnStyle}>Paste</button>
          <div style={dividerStyle} />
          <button onClick={handleSelectAll} style={btnStyle}>All</button>
        </div>
      )}
    </div>
  );
}

export { manager as terminalManager };

const wrapperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
};

const copyBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#313244',
  borderRadius: 8,
  padding: '2px 4px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  zIndex: 100,
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#cdd6f4',
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  borderRadius: 6,
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  backgroundColor: '#45475a',
};
