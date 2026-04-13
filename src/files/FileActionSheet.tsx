import React from 'react';

export type FileActionTarget =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'folder'; name: string; path: string; isRoot?: boolean };

export type FileAction =
  | 'download'
  | 'uploadFiles'
  | 'uploadFolder'
  | 'rename'
  | 'copy'
  | 'move'
  | 'pasteHere'
  | 'delete'
  | 'newFile'
  | 'newFolder';

interface Props {
  target: FileActionTarget | null;
  /** When true and target is a folder, show "Paste here" action. */
  clipboardHasContent?: boolean;
  onClose: () => void;
  onAction: (action: FileAction) => void;
}

export function FileActionSheet({ target, clipboardHasContent, onClose, onAction }: Props) {
  if (!target) return null;

  const actions: Array<{ id: FileAction; label: string; destructive?: boolean }> = [];
  if (target.kind === 'file') {
    actions.push({ id: 'download', label: 'Download' });
    actions.push({ id: 'rename', label: 'Rename' });
    actions.push({ id: 'copy', label: 'Copy' });
    actions.push({ id: 'move', label: 'Move' });
    actions.push({ id: 'delete', label: 'Delete', destructive: true });
  } else {
    actions.push({ id: 'uploadFiles', label: 'Upload files here' });
    actions.push({ id: 'uploadFolder', label: 'Upload folder here' });
    actions.push({ id: 'newFile', label: 'New file' });
    actions.push({ id: 'newFolder', label: 'New folder' });
    if (clipboardHasContent) actions.push({ id: 'pasteHere', label: 'Paste here' });
    if (!target.isRoot) {
      actions.push({ id: 'rename', label: 'Rename' });
      actions.push({ id: 'copy', label: 'Copy' });
      actions.push({ id: 'move', label: 'Move' });
      actions.push({ id: 'delete', label: 'Delete', destructive: true });
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 10000,
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10001,
          background: 'var(--bg-elevated, #151a1f)',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: '12px 16px 8px', color: 'var(--text-secondary)', fontSize: 12, borderBottom: '1px solid var(--border-subtle)' }}>
          {target.name}
        </div>
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              onAction(a.id);
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border-subtle)',
              color: a.destructive ? 'var(--accent-red, #ff4444)' : 'var(--text-primary)',
              fontSize: 15,
              textAlign: 'left',
            }}
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 15,
            textAlign: 'left',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
