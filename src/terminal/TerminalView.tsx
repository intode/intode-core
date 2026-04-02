import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalManager, TerminalSession } from './TerminalManager';
import { TerminalSelection, HandlePositions } from './TerminalSelection';
import { Ssh } from '../ssh/index';
import { debugLog } from '../lib/debug-log';

export interface TerminalViewProps {
  sessionId: string;
  defaultPath?: string;
  visible: boolean;
}

const manager = new TerminalManager();

export function TerminalView({ sessionId, defaultPath, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const selectionRef = useRef<TerminalSelection | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [showCopyBar, setShowCopyBar] = useState(false);
  const [handlePos, setHandlePos] = useState<HandlePositions | null>(null);

  const refreshHandles = useCallback(() => {
    setHandlePos(selectionRef.current?.getHandlePositions() ?? null);
  }, []);

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

      const sel = new TerminalSelection(session.terminal, {
        onSelectionStart: () => {
          setShowCopyBar(true);
          requestAnimationFrame(() => setHandlePos(sel.getHandlePositions()));
        },
        onSelectionChange: (has) => {
          if (!has) {
            setShowCopyBar(false);
            setHandlePos(null);
          } else {
            setHandlePos(sel.getHandlePositions());
          }
        },
      });
      sel.attach(container);
      selectionRef.current = sel;

      const { cols, rows } = session.terminal;
      await manager.attachShell(session, sessionId, cols, rows, defaultPath);

      // Focus terminal after init (visible effect can't — sessionRef is null on first render)
      setTimeout(() => {
        const el = container.querySelector('textarea.xterm-helper-textarea');
        if (el instanceof HTMLTextAreaElement) el.focus();
      }, 100);

      const observer = new ResizeObserver(() => {
        const s = sessionRef.current;
        if (!s || !container.offsetParent) return; // skip when hidden (display:none)
        s.fitAddon.fit();
        if (s.terminal.cols > 0 && s.terminal.rows > 0) {
          Ssh.resizeShell({ channelId: s.channelId, cols: s.terminal.cols, rows: s.terminal.rows });
        }
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
      setTimeout(() => {
        const el = containerRef.current?.querySelector('textarea.xterm-helper-textarea');
        if (el instanceof HTMLTextAreaElement) el.focus();
      }, 50);
    }
  }, [visible]);

  const handleCopy = useCallback(() => {
    selectionRef.current?.copySelection();
    selectionRef.current?.clearSelection();
    setShowCopyBar(false);
    setHandlePos(null);
  }, []);

  const handlePaste = useCallback(() => {
    selectionRef.current?.paste();
    selectionRef.current?.clearSelection();
    setShowCopyBar(false);
    setHandlePos(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    selectionRef.current?.selectAll();
    refreshHandles();
  }, [refreshHandles]);

  const startHandleDrag = useCallback((which: 'start' | 'end') => {
    const sel = selectionRef.current;
    if (!sel) return;
    sel.isHandleDrag = true;

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      sel.moveHandle(which, t.clientX, t.clientY);
      requestAnimationFrame(() => setHandlePos(sel.getHandlePositions()));
    };

    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      sel.isHandleDrag = false;
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, []);

  return (
    <div style={wrapperStyle}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', backgroundColor: 'var(--term-bg)' }}
      />

      {handlePos && (
        <>
          <Handle x={handlePos.start.x} y={handlePos.start.y} side="start"
            onDragStart={() => startHandleDrag('start')} />
          <Handle x={handlePos.end.x} y={handlePos.end.y} side="end"
            onDragStart={() => startHandleDrag('end')} />
        </>
      )}

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

// --- Selection Handle ---

const HANDLE_COLOR = '#89b4fa';
const HANDLE_SIZE = 18;
const STEM_H = 8;
const HIT_SIZE = 44;

function Handle({ x, y, side, onDragStart }: {
  x: number; y: number; side: 'start' | 'end'; onDragStart: () => void;
}) {
  const offset = side === 'start' ? -(HANDLE_SIZE / 2) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - HIT_SIZE / 2,
        top: y,
        width: HIT_SIZE,
        height: HIT_SIZE,
        zIndex: 101,
        touchAction: 'none',
      }}
      onTouchStart={(e) => { e.stopPropagation(); onDragStart(); }}
    >
      {/* Stem */}
      <div style={{
        position: 'absolute',
        left: (HIT_SIZE - 2) / 2,
        top: 0,
        width: 2,
        height: STEM_H,
        backgroundColor: HANDLE_COLOR,
      }} />
      {/* Circle */}
      <div style={{
        position: 'absolute',
        left: (HIT_SIZE - HANDLE_SIZE) / 2 + offset,
        top: STEM_H,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: '50%',
        backgroundColor: HANDLE_COLOR,
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </div>
  );
}

// --- Styles ---

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
