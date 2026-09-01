// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { FileActionSheet, availableFileActions, type FileActionTarget } from './FileActionSheet';
import { SelectionActionBar } from './SelectionActionBar';
import { setSshCapabilities } from '../ssh/capabilities';

const FILE: FileActionTarget = { kind: 'file', name: 'notes.md', path: '/home/u/notes.md' };
const FOLDER: FileActionTarget = { kind: 'folder', name: 'src', path: '/home/u/src' };
const ROOT: FileActionTarget = { kind: 'folder', name: '~', path: '/home/u', isRoot: true };

const ids = (t: FileActionTarget, clipboard = false) =>
  availableFileActions(t, clipboard).map((a) => a.id);

afterEach(() => {
  cleanup();
  setSshCapabilities({});
});

describe('availableFileActions', () => {
  it('offers everything when the runtime implements everything', () => {
    expect(ids(FILE)).toEqual(['download', 'select', 'rename', 'copy', 'move', 'delete']);
    expect(ids(ROOT, true)).toEqual(['uploadFiles', 'uploadFolder', 'newFile', 'newFolder', 'pasteHere']);
  });

  it('drops transfer actions but keeps file operations', () => {
    setSshCapabilities({ fileTransfer: false });
    expect(ids(FILE)).toEqual(['select', 'rename', 'copy', 'move', 'delete']);
    expect(ids(ROOT, true)).toEqual(['newFile', 'newFolder', 'pasteHere']);
  });

  it('drops file operations but keeps transfer', () => {
    setSshCapabilities({ fileOps: false });
    expect(ids(FILE)).toEqual(['download', 'select']);
    expect(ids(ROOT, true)).toEqual(['uploadFiles', 'uploadFolder']);
    expect(ids(FOLDER, true)).toEqual(['uploadFiles', 'uploadFolder', 'download', 'select']);
  });

  it('drops selection mode only when nothing is left to do in bulk', () => {
    setSshCapabilities({ fileOps: false, fileTransfer: false });
    expect(ids(FILE)).toEqual([]);
    expect(ids(FOLDER, true)).toEqual([]);
    expect(ids(ROOT, true)).toEqual([]);
  });
});

describe('FileActionSheet', () => {
  it('shows no sheet at all rather than a lone Cancel', () => {
    setSshCapabilities({ fileOps: false, fileTransfer: false });
    const { container } = render(
      <FileActionSheet target={FILE} onClose={() => {}} onAction={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('still opens when one action survives', () => {
    setSshCapabilities({ fileOps: false });
    render(<FileActionSheet target={FILE} onClose={() => {}} onAction={() => {}} />);
    expect(screen.getByText('Download')).toBeTruthy();
    expect(screen.queryByText('Rename')).toBeNull();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});

describe('SelectionActionBar', () => {
  const bar = () => (
    <SelectionActionBar
      count={2}
      scanning={false}
      onCancel={vi.fn()}
      onDownload={vi.fn()}
      onCopy={vi.fn()}
      onMove={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  it('shows every bulk action when the runtime has them', () => {
    render(bar());
    for (const label of ['Download', 'Copy', 'Move', 'Delete']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('hides the actions the runtime cannot perform, and never the way out', () => {
    setSshCapabilities({ fileOps: false, fileTransfer: false });
    render(bar());
    for (const label of ['Download', 'Copy', 'Move', 'Delete']) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
    expect(screen.getByLabelText('Cancel selection')).toBeTruthy();
  });
});
