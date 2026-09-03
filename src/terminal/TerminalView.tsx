import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalManager, TerminalSession } from './TerminalManager';
import { TerminalSelection, HandlePositions } from './TerminalSelection';
import { PinchZoom } from '../gestures/PinchZoom';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';
import { loadZoom, saveZoom } from '../gestures/zoom-store';
import { openInPreview } from '../app/preview-hooks';
import { getNativeTerminalProvider, type SwipeListenerHandle } from './terminal-provider';
import { describeFailure } from '../ssh/unavailable';

function isKeyboardVisible(): boolean {
  const vv = window.visualViewport;
  if (!vv) return false;
  return window.innerHeight - vv.height > 50;
}

export interface TerminalViewProps {
  sessionId: string;
  defaultPath?: string;
  terminalId?: string;
  visible: boolean;
  tmuxSession?: string;
  /**
   * Reconnects the workspace this terminal belongs to. Without it the disconnected banner
   * still reports the state but cannot offer the retry.
   */
  onReconnect?: () => Promise<void>;
}

const manager = new TerminalManager();

export function TerminalView({ sessionId, defaultPath, terminalId, visible, tmuxSession, onReconnect }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const selectionRef = useRef<TerminalSelection | null>(null);
  const pinchRef = useRef<PinchZoom | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const nativeIdRef = useRef<string | null>(null);
  const [showCopyBar, setShowCopyBar] = useState(false);
  const [handlePos, setHandlePos] = useState<HandlePositions | null>(null);
  const [shellError, setShellError] = useState<{ title: string; detail?: string } | null>(null);
  const [sessionDown, setSessionDown] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const refreshHandles = useCallback(() => {
    setHandlePos(selectionRef.current?.getHandlePositions() ?? null);
  }, []);

  const nativeProvider = getNativeTerminalProvider();
  const useNative = nativeProvider?.isAvailable() ?? false;

  // ====== SESSION LIVENESS ======
  // The only push notification that a session died. Everything else has to ask, and nothing
  // asks on a schedule — so without this the shell just stops answering and the terminal keeps
  // looking normal. On a half-open socket `getStatus` reports `connected`, which is why
  // polling it would not have worked either.
  //
  // Resubscribing on sessionId also resets the banner: a successful reconnect hands this
  // component a new id, and that is exactly when the old failure stops being true.
  useEffect(() => {
    setSessionDown(false);
    setReconnecting(false);
    let handle: { remove(): void } | null = null;
    let cancelled = false;
    Ssh.addListener('connectionStatus', (e) => {
      if (e.sessionId !== sessionId) return;
      if (e.status === 'connected') setSessionDown(false);
      else if (e.status === 'disconnected' || e.status === 'error') setSessionDown(true);
    }).then((h) => {
      if (cancelled) h.remove();
      else handle = h;
    }).catch(() => { /* platform without the event — banner simply never shows */ });
    return () => { cancelled = true; handle?.remove(); };
  }, [sessionId]);

  const handleReconnect = useCallback(async () => {
    if (!onReconnect || reconnecting) return;
    setReconnecting(true);
    try {
      await onReconnect();
      // Success swaps sessionId, and the effect above clears the banner. Leave the spinner
      // up until that happens so the button cannot be double-fired.
    } catch {
      setReconnecting(false);
    }
  }, [onReconnect, reconnecting]);

  // ====== NATIVE TERMINAL PATH ======
  useEffect(() => {
    if (!useNative || !containerRef.current || !sessionId) return;
    let cancelled = false;
    const container = containerRef.current;
    const id = terminalId || crypto.randomUUID();
    nativeIdRef.current = id;

    // Open at the size the user last pinched to — the native view uses it as the
    // pinch baseline, so it has to be passed at creation rather than set after.
    nativeProvider!.createTerminal(id, sessionId, defaultPath, tmuxSession, loadZoom('terminal')).then(() => {
      if (cancelled) return;
      if (visible && container.offsetParent) {
        const rect = container.getBoundingClientRect();
        nativeProvider!.showTerminal(id, { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, { showKeyboard: isKeyboardVisible() });
      }
    }).catch(() => {});

    // Native pinch zoom happens entirely in the view; this is how the size gets back here to be saved.
    let fontSizeListener: SwipeListenerHandle | null = null;
    nativeProvider!.addFontSizeListener?.((e) => {
      if (e.terminalId === id) saveZoom('terminal', e.size);
    }).then((handle) => {
      if (cancelled) handle.remove();
      else fontSizeListener = handle;
    }).catch(() => {});

    const observer = new ResizeObserver(() => {
      if (!container.offsetParent || cancelled) return;
      const rect = container.getBoundingClientRect();
      nativeProvider!.resizeTerminal(id, { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      fontSizeListener?.remove();
      nativeProvider!.destroyTerminal(id).catch(() => {});
      nativeIdRef.current = null;
    };
  }, [useNative, sessionId]);

  // Native visibility + active tracking
  useEffect(() => {
    if (!useNative || !nativeIdRef.current) return;
    const id = nativeIdRef.current;
    const container = containerRef.current;
    if (visible && container?.offsetParent) {
      const rect = container.getBoundingClientRect();
      nativeProvider!.showTerminal(id, { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, { showKeyboard: isKeyboardVisible() });
    } else {
      nativeProvider!.hideTerminal(id);
    }
  }, [useNative, visible]);

  // ====== XTERM.JS PATH (existing) ======
  useEffect(() => {
    if (useNative) return;
    if (!containerRef.current || !sessionId) return;
    let cancelled = false;
    setShellError(null);

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
        initialFontSize: session.terminal.options.fontSize ?? loadZoom('terminal'),
        onFontSizeChange: (size) => {
          session.terminal.options.fontSize = size;
          session.fitAddon.fit();
          if (container.offsetParent && session.terminal.cols > 0 && session.terminal.rows > 0) {
            Ssh.resizeShell({ channelId: session.channelId, cols: session.terminal.cols, rows: session.terminal.rows });
          }
        },
        onZoomEnd: (size) => saveZoom('terminal', size),
      });
      pinch.attach();
      pinchRef.current = pinch;


      const observer = new ResizeObserver(() => {
        const s = sessionRef.current;
        if (!s || !container.offsetParent) return;
        s.fitAddon.fit();
        if (s.terminal.cols > 0 && s.terminal.rows > 0) {
          Ssh.resizeShell({ channelId: s.channelId, cols: s.terminal.cols, rows: s.terminal.rows });
        }
      });
      observer.observe(container);
      resizeObserverRef.current = observer;
    }

    // The shell can fail to open — no implementation in this build, or the
    // server refused. Before this catch the rejection escaped and the terminal
    // body stayed blank forever with nothing on screen to explain it.
    init().catch((e: unknown) => {
      if (cancelled) return;
      setShellError(describeFailure('Terminal', e));
    });

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
  }, [useNative, sessionId]);

  // xterm.js visibility
  useEffect(() => {
    if (useNative) return;
    if (sessionRef.current && visible) {
      manager.switchTo(sessionRef.current.id);
      sessionRef.current.fitAddon.fit();
    }
  }, [useNative, visible]);

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
      {/*
        Above the terminal, not over it. Native terminal views always render on top of the
        WebView (see .claude/rules/native-terminal.md), so a DOM overlay placed inside the
        terminal's rect would be hidden by the very thing it describes. Sitting outside it
        also shrinks the container, and the ResizeObserver below forwards that to the native
        view — which keeps the dead terminal's contents readable instead of covering them.
      */}
      {sessionDown && (
        <div
          style={bannerStyle}
          onClick={handleReconnect}
          role="button"
          aria-label="Reconnect"
        >
          <span style={bannerTitleStyle}>
            {reconnecting ? 'Reconnecting…' : 'Disconnected — Tap to reconnect'}
          </span>
          {tmuxSession && (
            <span style={bannerDetailStyle}>Your tmux session is still running on the server.</span>
          )}
        </div>
      )}

      <div style={surfaceStyle}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', backgroundColor: 'var(--term-bg)' }}
      />

      {!useNative && shellError && (
        <div style={shellErrorStyle}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 9l3 3-3 3M13 15h5" />
          </svg>
          <p style={shellErrorTitleStyle}>{shellError.title}</p>
          {shellError.detail && <p style={shellErrorDetailStyle}>{shellError.detail}</p>}
        </div>
      )}

      {/* Selection handles & copy bar only for xterm.js path */}
      {!useNative && handlePos && (
        <>
          <Handle x={handlePos.start.x} y={handlePos.start.y} side="start"
            onDragStart={() => startHandleDrag('start')} />
          <Handle x={handlePos.end.x} y={handlePos.end.y} side="end"
            onDragStart={() => startHandleDrag('end')} />
        </>
      )}

      {!useNative && showCopyBar && handlePos && (() => {
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
  display: 'flex',
  flexDirection: 'column',
};

/**
 * Holds the terminal and everything positioned against it. The absolute children (selection
 * handles, copy bar, shell error) measure from this box, so it has to be the same box the
 * terminal fills — putting the banner in here instead would shift all of them by its height.
 */
const surfaceStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  width: '100%',
};

const bannerStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 12px',
  backgroundColor: 'var(--bg-surface0)',
  borderBottom: '1px solid var(--bg-surface1)',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

const bannerTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--accent-blue)',
};

const bannerDetailStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
};

const shellErrorStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '0 24px',
  textAlign: 'center',
  backgroundColor: 'var(--term-bg)',
  zIndex: 1,
};

const shellErrorTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  margin: 0,
};

const shellErrorDetailStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  margin: 0,
  maxWidth: 320,
  wordBreak: 'break-word',
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
