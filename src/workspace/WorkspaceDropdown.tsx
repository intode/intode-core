import React, { useEffect, useState } from 'react';
import { Workspace, getWorkspaceStore } from './WorkspaceManager';

interface Props {
  current: Workspace;
  connectedIds: Set<string>;
  onSwitch: (ws: Workspace) => void;
  onAdd: () => void;
}

export function WorkspaceDropdown({ current, connectedIds, onSwitch, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Workspace[]>([]);

  useEffect(() => {
    if (open) getWorkspaceStore().getAll().then(setList);
  }, [open]);

  return (
    <div style={rootStyle}>
      <button onClick={() => setOpen((o) => !o)} style={triggerStyle}>
        <span style={nameStyle}>{current.name}</span>
        <span style={chevronStyle}>{open ? '\u25b4' : '\u25be'}</span>
      </button>

      {open && (
        <>
          <div style={backdropStyle} onClick={() => setOpen(false)} />
          <div style={panelStyle}>
            {list.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setOpen(false);
                  if (ws.id !== current.id) onSwitch(ws);
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
            <div style={sepStyle} />
            <button
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
              style={addBtnStyle}
            >
              + Add Workspace
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
};

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
  color: '#cdd6f4',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const chevronStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#a6adc8',
  flexShrink: 0,
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 200,
};

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: -8,
  marginTop: 12,
  width: 260,
  maxHeight: 320,
  overflowY: 'auto',
  backgroundColor: '#313244',
  borderRadius: 10,
  padding: 4,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  zIndex: 201,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 12px',
  background: 'none',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  textAlign: 'left',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

const activeStyle: React.CSSProperties = {
  backgroundColor: '#45475a',
};

const itemInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#cdd6f4',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const itemHostStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#a6adc8',
  marginTop: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dotStyle: React.CSSProperties = {
  color: '#a6e3a1',
  fontSize: 10,
  flexShrink: 0,
};

const sepStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: '#45475a',
  margin: '4px 8px',
};

const addBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  background: 'none',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  color: '#89b4fa',
  fontWeight: 500,
  textAlign: 'left',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};
