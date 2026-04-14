import React from 'react';
import { Workspace } from './WorkspaceManager';
import { OVERLAY } from '../lib/styles';

interface Props {
  workspace: Workspace;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  zIndex?: number;
}

export function WorkspaceContextMenu({ workspace, onEdit, onDelete, onCancel, zIndex = 300 }: Props) {
  return (
    <div style={{ ...overlayStyle, zIndex }} onClick={onCancel}>
      <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
        <p style={menuTitle}>{workspace.name}</p>
        <button style={menuItem} onClick={onEdit}>Edit</button>
        <button style={{ ...menuItem, color: 'var(--accent-red)' }} onClick={onDelete}>Delete</button>
        <button style={menuItem} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  ...OVERLAY,
};

const menuStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface0)',
  borderRadius: 12,
  padding: '16px 0',
  minWidth: 250,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const menuTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-primary)',
  padding: '0 20px 12px',
  borderBottom: '1px solid var(--bg-surface1)',
  margin: 0,
};

const menuItem: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px 20px',
  background: 'none',
  border: 'none',
  textAlign: 'left',
  color: 'var(--text-primary)',
  fontSize: 15,
  cursor: 'pointer',
};
