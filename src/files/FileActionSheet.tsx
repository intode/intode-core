import React from 'react';
import { getSshCapabilities } from '../ssh/capabilities';

export type FileActionTarget =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'folder'; name: string; path: string; isRoot?: boolean };

export type FileAction =
  | 'download'
  | 'select'
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

/**
 * Which actions this runtime can actually carry out.
 *
 * An action the host cannot perform is left out rather than shown and failed —
 * a button that always errors reads as a broken app, not as a limitation.
 * Selection mode only exists to run these same actions in bulk, so it goes
 * when every one of them is gone.
 */
export function availableFileActions(
  target: FileActionTarget,
  clipboardHasContent: boolean,
): Array<{ id: FileAction; label: string; destructive?: boolean }> {
  const { fileOps, fileTransfer } = getSshCapabilities();
  const actions: Array<{ id: FileAction; label: string; destructive?: boolean }> = [];

  // Download, rename, copy, move and delete are offered on any node that is not
  // the tree root — the root itself is only a place to put things.
  const pushNodeActions = () => {
    if (fileTransfer) actions.push({ id: 'download', label: 'Download' });
    if (fileOps || fileTransfer) actions.push({ id: 'select', label: 'Select' });
    if (fileOps) {
      actions.push({ id: 'rename', label: 'Rename' });
      actions.push({ id: 'copy', label: 'Copy' });
      actions.push({ id: 'move', label: 'Move' });
      actions.push({ id: 'delete', label: 'Delete', destructive: true });
    }
  };

  if (target.kind === 'file') {
    pushNodeActions();
  } else {
    if (fileTransfer) {
      actions.push({ id: 'uploadFiles', label: 'Upload files here' });
      actions.push({ id: 'uploadFolder', label: 'Upload folder here' });
    }
    if (fileOps) {
      actions.push({ id: 'newFile', label: 'New file' });
      actions.push({ id: 'newFolder', label: 'New folder' });
      if (clipboardHasContent) actions.push({ id: 'pasteHere', label: 'Paste here' });
    }
    if (!target.isRoot) pushNodeActions();
  }

  return actions;
}

export function FileActionSheet({ target, clipboardHasContent, onClose, onAction }: Props) {
  if (!target) return null;

  const actions = availableFileActions(target, !!clipboardHasContent);
  // Nothing this runtime can do to the node — show no sheet rather than a lone Cancel.
  if (actions.length === 0) return null;

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
