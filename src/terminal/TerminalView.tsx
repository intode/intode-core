import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalManager, TerminalSession } from './TerminalManager';
import { TerminalSelection, HandlePositions } from './TerminalSelection';
import { PinchZoom } from '../gestures/PinchZoom';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';
import { TERMINAL_FONT_SIZE } from '../lib/constants';
import { openInPreview } from '../app/preview-hooks';

export interface TerminalViewProps {
  sessionId: string;
  defaultPath?: string;
  terminalId?: string;
  visible: boolean;
}

const manager = new TerminalManager();

export function TerminalView({ sessionId, defaultPath, terminalId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const selectionRef = useRef<TerminalSelection | null>(null);
  const pinchRef = useRef<PinchZoom | null>(null);
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
        onMouseWheel: (direction) => {
          if (!session.channelId) return;
          const col = Math.floor(session.terminal.cols / 2);
          const row = Math.floor(session.terminal.rows / 2);
          const btn = direction === 'up' ? 64 : 65;
          const seq = `\x1b[<${btn};${col};${row}M`;
          Ssh.writeToShell({ channelId: session.channelId, data: encodeUtf8Base64(seq) }).catch(() => {});
        },
        onLinkActivate: (url) => {
          try {
            const parsed = new URL(url);
            const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0';
            if (isLocal && openInPreview(url)) return;
          } catch { /* */ }
          window.open(url, '_blank');
        },
      });
      sel.attach(container);
      selectionRef.current = sel;

      const { cols, rows } = session.terminal;
      await manager.attachShell(session, sessionId, cols, rows, defaultPath);

      // Pinch zoom for font size
      const pinch = new PinchZoom({
        element: container,
        initialFontSize: TERMINAL_FONT_SIZE,
        onFontSizeChange: (size) => {
          session.terminal.options.fontSize = size;
          session.fitAddon.fit();
          if (container.offsetParent && session.terminal.cols > 0 && session.terminal.rows > 0) {
            Ssh.resizeShell({ channelId: session.channelId, cols: session.terminal.cols, rows: session.terminal.rows });
          }
        },
      });
      pinch.attach();
      pinchRef.current = pinch;

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
      pinchRef.current?.detach();
      pinchRef.current = null;
      if (sessionRef.current) {
        manager.destroySession(sessionRef.current.id);
        sessionRef.current = null;
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (sessionRef.current && visible) {
      manager.switchTo(sessionRef.current.id);
      sessionRef.current.fitAddon.fit();
      // Focus terminal textarea when tab becomes visible
      const el = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
      if (el) setTimeout(() => el.focus(), 50);
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

  const getSelectedText = useCallback((): string => {
    return sessionRef.current?.terminal.getSelection()?.trim() ?? '';
  }, []);

  const isUrl = (text: string): boolean => /^https?:\/\/\S+$/.test(text);

  const handleOpenLink = useCallback(() => {
    const text = getSelectedText();
    if (!isUrl(text)) return;
    selectionRef.current?.clearSelection();
    setShowCopyBar(false);
    setHandlePos(null);
    try {
      const parsed = new URL(text);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0';
      if (isLocal && openInPreview(text)) return;
    } catch { /* */ }
    window.open(text, '_blank');
  }, [getSelectedText]);

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

      {showCopyBar && handlePos && (() => {
        const selectedText = getSelectedText();
        const showOpen = isUrl(selectedText);
        const barY = Math.max(4, handlePos.start.y - 44);
        const barX = (handlePos.start.x + handlePos.end.x) / 2;
        return (
          <div style={{ ...copyBarStyle, top: barY, left: barX }}>
            <button onClick={handleCopy} style={btnStyle}>Copy</button>
            <div style={dividerStyle} />
            <button onClick={handlePaste} style={btnStyle}>Paste</button>
            <div style={dividerStyle} />
            <button onClick={handleSelectAll} style={btnStyle}>All</button>
            {showOpen && (
              <>
                <div style={dividerStyle} />
                <button onClick={handleOpenLink} style={{ ...btnStyle, color: 'var(--accent-blue)' }}>Open</button>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export { manager as terminalManager };

// --- Selection Handle ---

const HANDLE_COLOR = 'var(--accent-blue)';
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
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--bg-surface0)',
  borderRadius: 8,
  padding: '2px 4px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  zIndex: 100,
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
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
  backgroundColor: 'var(--bg-surface1)',
};
