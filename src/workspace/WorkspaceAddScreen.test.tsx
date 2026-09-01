// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

const listSshKeys = vi.fn(async () => ({ keys: [{ id: 'k1', name: 'laptop', type: 'ed25519' }] }));

vi.mock('../ssh/index', () => ({
  Ssh: {
    listSshKeys: (...a: unknown[]) => listSshKeys(...(a as [])),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

import { WorkspaceAddScreen } from './WorkspaceAddScreen';
import { setWorkspaceStore } from './WorkspaceManager';
import type { Workspace, WorkspaceStore } from './WorkspaceManager';
import { setSshCapabilities } from '../ssh/capabilities';

const store: WorkspaceStore = {
  getAll: async () => [],
  create: async () => ({} as Workspace),
  update: async () => {},
  delete: async () => {},
  reorder: async () => {},
  getPassword: async () => 'hunter2',
  savePassword: async () => {},
  getJumpHostPasswords: async () => [],
  saveJumpHostPasswords: async () => {},
};

const keyWorkspace: Workspace = {
  id: 'w1', name: 'box', host: 'h', port: 22, username: 'u', authType: 'key',
  keyId: 'k1', defaultPath: '~', lastConnectedAt: null, createdAt: 0, updatedAt: 0, sortOrder: 0,
};

beforeEach(() => {
  listSshKeys.mockClear();
  setWorkspaceStore(store);
});

afterEach(() => {
  cleanup();
  setSshCapabilities({});
});

const renderAdd = (editWorkspace?: Workspace) =>
  render(<WorkspaceAddScreen onSave={vi.fn()} onCancel={vi.fn()} editWorkspace={editWorkspace} />);

/** "SSH Key" is also the field label, so pick the toggle out by tag. */
const keyToggle = () =>
  screen.queryAllByText('SSH Key').find((el) => el.tagName === 'BUTTON') ?? null;

describe('WorkspaceAddScreen key auth availability', () => {
  it('offers key auth when the runtime can both store keys and use them', () => {
    renderAdd();
    expect(keyToggle()).toBeTruthy();
  });

  it('hides key auth when connect() would ignore the key', () => {
    setSshCapabilities({ keyAuth: false });
    renderAdd();
    expect(keyToggle()).toBeNull();
  });

  it('hides key auth, and does not ask for a key list, without key management', () => {
    setSshCapabilities({ keyManagement: false, keyAuth: false });
    renderAdd();
    expect(keyToggle()).toBeNull();
    expect(listSshKeys).not.toHaveBeenCalled();
  });

  it('keeps a saved key workspace readable, and still saveable, where key auth does not work', async () => {
    setSshCapabilities({ keyManagement: false, keyAuth: false });
    renderAdd(keyWorkspace);

    // The option stays visible because this record is on it — hiding it would
    // make the user's own setting invisible.
    expect(keyToggle()).toBeTruthy();
    expect(screen.getByText('Key authentication is not available on this platform')).toBeTruthy();
    // No key list, so the stored id stands in for the name.
    expect(screen.getByText('k1')).toBeTruthy();
    // Generate/Import belong to the key manager, which is gone too.
    expect(screen.queryByText('+ Generate')).toBeNull();
    expect(screen.queryByText('+ Import')).toBeNull();

    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false);
    // Testing it could only fail, and the failure would come from the bridge.
    await waitFor(() =>
      expect((screen.getByText('Test Connection') as HTMLButtonElement).disabled).toBe(true),
    );
  });

  it('names no operating system anywhere on the screen', () => {
    setSshCapabilities({ keyManagement: false, keyAuth: false });
    const { container } = renderAdd(keyWorkspace);
    expect(container.textContent ?? '').not.toMatch(/\bios\b|android|iphone/i);
  });
});
