// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { WorkspaceListScreen } from './WorkspaceListScreen';
import { setWorkspaceStore } from './WorkspaceManager';
import type { Workspace, WorkspaceStore } from './WorkspaceManager';

function ws(id: string, sortOrder: number): Workspace {
  return {
    id, name: id, host: 'h', port: 22, username: 'u', authType: 'password',
    defaultPath: '~', lastConnectedAt: null, createdAt: 0, updatedAt: 0, sortOrder,
  };
}

function installStore(list: Workspace[]) {
  const store: WorkspaceStore = {
    getAll: async () => list,
    create: async () => list[0],
    update: async () => {},
    delete: async () => {},
    reorder: vi.fn(async () => {}),
    getPassword: async () => null,
    savePassword: async () => {},
    getJumpHostPasswords: async () => [],
    saveJumpHostPasswords: async () => {},
  };
  setWorkspaceStore(store);
  return store;
}

function renderScreen() {
  return render(
    <WorkspaceListScreen onSelectWorkspace={vi.fn()} onAddWorkspace={vi.fn()} />,
  );
}

afterEach(cleanup);

describe('WorkspaceListScreen reorder mode', () => {
  it('enters reorder mode via context menu and exits via DONE', async () => {
    installStore([ws('alpha', 0), ws('beta', 1)]);
    renderScreen();
    fireEvent.contextMenu(await screen.findByText('alpha'));
    fireEvent.click(screen.getByText('Reorder'));

    expect(screen.getByText('DONE')).toBeTruthy();
    expect(screen.queryByText('+')).toBeNull();          // FAB hidden
    expect(screen.queryByText('Reorder')).toBeNull();    // menu closed

    fireEvent.click(screen.getByText('DONE'));
    expect(screen.queryByText('DONE')).toBeNull();
    expect(screen.getByText('+')).toBeTruthy();          // FAB restored
  });

  it('hides the Reorder menu item when only one workspace exists', async () => {
    installStore([ws('solo', 0)]);
    renderScreen();
    fireEvent.contextMenu(await screen.findByText('solo'));
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.queryByText('Reorder')).toBeNull();
  });

  it('does not open the workspace when a card is tapped in reorder mode', async () => {
    installStore([ws('alpha', 0), ws('beta', 1)]);
    const onSelect = vi.fn();
    render(<WorkspaceListScreen onSelectWorkspace={onSelect} onAddWorkspace={vi.fn()} />);
    fireEvent.contextMenu(await screen.findByText('alpha'));
    fireEvent.click(screen.getByText('Reorder'));
    fireEvent.click(screen.getByText('beta'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
