import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Workspace, getWorkspaceStore } from './WorkspaceManager';
import { notifyOverlayOpen, notifyOverlayClose } from '../app/overlay-hooks';

interface WorkspaceDropdownProps {
  current: Workspace;
  connectedIds: Set<string>;
  onSwitch: (ws: Workspace) => void;
  onAdd: () => void;
}

export function WorkspaceDropdown({ current, connectedIds, onSwitch, onAdd }: WorkspaceDropdownProps) {
  const [mounted, setMounted] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const [list, setList] = useState<Workspace[]>([]);
  const closingRef = useRef(false);

  const open = useCallback(() => {
    getWorkspaceStore().getAll().then(setList);
    notifyOverlayOpen();
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
  }, []);

  const close = useCallback((restore = true) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setAnimIn(false);
    setTimeout(() => {
      setMounted(false);
      closingRef.current = false;
      notifyOverlayClose(restore);
    }, 250);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (mounted) notifyOverlayClose(); }, []);

  return (
    <>
      <button onClick={open} style={triggerStyle}>
        <span style={nameStyle}>{current.name}</span>
        <span style={chevronStyle}>{'\u25be'}</span>
      </button>

      {mounted && (
        <div
          style={{ ...backdropStyle, opacity: animIn ? 1 : 0 }}
          onClick={() => close()}
        >
          <div
            style={{ ...sheetStyle, transform: animIn ? 'translateY(0)' : 'translateY(100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={handleBarWrap}><div style={handleBar} /></div>
            <div style={sheetHeaderStyle}>
              <span style={sheetTitleStyle}>Workspaces</span>
              <button onClick={() => close()} style={sheetCloseStyle}>{'\u2715'}</button>
            </div>
            <div style={sheetListStyle}>
              {list.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    const switching = ws.id !== current.id;
                    close(!switching);
                    if (switching) setTimeout(() => onSwitch(ws), 260);
                  }}
                  style={{
                    ...itemStyle,
                    ...(ws.id === current.id ? activeStyle : {}),
                  }}
                >
                  <div style={itemInfoStyle}>
                    <div style={itemNameStyle}>{ws.name}</div>
                    <div style={itemHostStyle}>
                      {ws.username}@{ws.host}
                    </div>
                  </div>
                  {connectedIds.has(ws.id) && <span style={dotStyle}>{'\u25cf'}</span>}
                </button>
              ))}
            </div>
            <div style={sheetFooterStyle}>
              <button
                onClick={() => {
                  close(false);
                  setTimeout(onAdd, 260);
                }}
                style={addBtnStyle}
              >
                + Add Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const triggerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  maxWidth: '100%',
};

const nameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const chevronStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-tertiary)',
  flexShrink: 0,
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  transition: 'opacity 250ms ease',
};

const sheetStyle: React.CSSProperties = {
  width: '100%',
  height: 'calc(100% - 80px)',
  backgroundColor: 'var(--bg-surface0)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  border: '1px solid var(--bg-surface1)',
  borderBottom: 'none',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
};

const handleBarWrap: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '10px 0 2px',
  flexShrink: 0,
};

const handleBar: React.CSSProperties = {
  width: 36,
  height: 4,
  borderRadius: 2,
  backgroundColor: 'var(--text-tertiary)',
  opacity: 0.4,
};

const sheetHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 20px 12px',
  borderBottom: '1px solid var(--bg-surface1)',
  flexShrink: 0,
};

const sheetTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const sheetCloseStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-tertiary)',
  fontSize: 16,
  cursor: 'pointer',
  padding: '4px 8px',
};

const sheetListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
};

const sheetFooterStyle: React.CSSProperties = {
  padding: '8px 12px 20px',
  borderTop: '1px solid var(--bg-surface1)',
  flexShrink: 0,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '12px 12px',
  background: 'none',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  textAlign: 'left',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

const activeStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface1)',
};

const itemInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const itemHostStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-tertiary)',
  marginTop: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dotStyle: React.CSSProperties = {
  color: 'var(--accent-green)',
  fontSize: 10,
  flexShrink: 0,
};

const addBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px',
  background: 'none',
  border: '1px solid var(--bg-surface1)',
  borderRadius: 10,
  fontSize: 14,
  color: 'var(--accent-blue)',
  fontWeight: 500,
  textAlign: 'center',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};
