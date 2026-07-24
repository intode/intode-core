// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { WorkspaceDropdown } from './WorkspaceDropdown';
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

function renderDropdown(current: Workspace, onSwitch = vi.fn()) {
  render(
    <WorkspaceDropdown
      current={current}
      connectedIds={new Set()}
      onSwitch={onSwitch}
      onAdd={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn(async () => {})}
    />,
  );
  return onSwitch;
}

afterEach(cleanup);

describe('WorkspaceDropdown reorder mode', () => {
  it('enters reorder mode via context menu and exits via DONE', async () => {
    const alpha = ws('alpha', 0);
    installStore([alpha, ws('beta', 1)]);
    renderDropdown(alpha);
    fireEvent.click(screen.getByText('alpha'));            // trigger opens sheet
    fireEvent.contextMenu(await screen.findByText('beta'));
    fireEvent.click(screen.getByText('Reorder'));

    expect(screen.getByText('DONE')).toBeTruthy();
    expect(screen.queryByText('+ Add Workspace')).toBeNull();               // footer hidden
    expect(screen.queryByRole('button', { name: 'Reorder' })).toBeNull();   // menu closed (header title also says Reorder)

    fireEvent.click(screen.getByText('DONE'));
    expect(screen.queryByText('DONE')).toBeNull();
    expect(screen.getByText('+ Add Workspace')).toBeTruthy();
  });

  it('hides the Reorder menu item when only one workspace exists', async () => {
    const solo = ws('solo', 0);
    installStore([solo]);
    renderDropdown(solo);
    fireEvent.click(screen.getByText('solo'));
    // The trigger also says 'solo' — wait for the row's host line instead.
    fireEvent.contextMenu(await screen.findByText('u@h'));
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.queryByText('Reorder')).toBeNull();
  });

  it('does not switch workspace when a row is tapped in reorder mode', async () => {
    const alpha = ws('alpha', 0);
    installStore([alpha, ws('beta', 1)]);
    const onSwitch = renderDropdown(alpha);
    fireEvent.click(screen.getByText('alpha'));
    fireEvent.contextMenu(await screen.findByText('beta'));
    fireEvent.click(screen.getByText('Reorder'));
    fireEvent.click(screen.getByText('beta'));
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
