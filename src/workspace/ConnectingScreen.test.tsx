// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const connect = vi.fn(async (_o: unknown) => ({ sessionId: 'sess1' }));
const getPendingHostKey = vi.fn(async () => ({ prompt: null as HostKeyPrompt | null }));
const acceptHostKey = vi.fn(async (_o: unknown) => {});

// The arrows defer the lookups: vi.mock is hoisted above the consts above.
vi.mock('../ssh/index', () => ({
  Ssh: {
    connect: (...a: unknown[]) => connect(a[0]),
    getPendingHostKey: () => getPendingHostKey(),
    acceptHostKey: (...a: unknown[]) => acceptHostKey(a[0]),
  },
}));

import { ConnectingScreen } from './ConnectingScreen';
import { setWorkspaceStore } from './WorkspaceManager';
import type { Workspace, WorkspaceStore } from './WorkspaceManager';
import type { HostKeyPrompt } from '../ssh/plugin-api';

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

const workspace: Workspace = {
  id: 'w1', name: 'box', host: 'target.example.com', port: 22, username: 'root',
  authType: 'password', defaultPath: '~', lastConnectedAt: null,
  createdAt: 0, updatedAt: 0, sortOrder: 0,
};

// The hop that refuses need not be the workspace host — a jump chain stops wherever it
// stops, and the prompt names that hop.
const unknownKey: HostKeyPrompt = {
  host: 'bastion.example.com', port: 2222,
  fingerprint: 'SHA256:AAAAnewkey', keyType: 'ssh-ed25519',
};

beforeEach(() => {
  connect.mockReset();
  connect.mockResolvedValue({ sessionId: 'sess1' });
  getPendingHostKey.mockReset();
  getPendingHostKey.mockResolvedValue({ prompt: null });
  acceptHostKey.mockReset();
  acceptHostKey.mockResolvedValue(undefined);
  setWorkspaceStore(store);
});

afterEach(cleanup);

describe('ConnectingScreen host key prompt', () => {
  it('prompts for an unknown key, then connects once it is trusted', async () => {
    connect.mockRejectedValueOnce(new Error('reject HostKey'));
    getPendingHostKey.mockResolvedValueOnce({ prompt: unknownKey });
    const onConnected = vi.fn();
    const onFailed = vi.fn();

    render(
      <ConnectingScreen workspace={workspace} onConnected={onConnected} onFailed={onFailed} onCancel={vi.fn()} />,
    );

    expect(await screen.findByText('Unknown Host Key')).toBeTruthy();
    expect(screen.getByText(unknownKey.fingerprint)).toBeTruthy();
    // A pending key is not a connection failure the caller should hear about.
    expect(onFailed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Trust'));

    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('sess1'));
    expect(acceptHostKey).toHaveBeenCalledWith({
      host: 'bastion.example.com', port: 2222, fingerprint: 'SHA256:AAAAnewkey',
      // Recorded alongside the trust so the Known Hosts screen can name the algorithm.
      keyType: 'ssh-ed25519',
    });
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('warns instead of asking when a trusted key changed', async () => {
    connect.mockRejectedValueOnce(new Error('reject HostKey'));
    getPendingHostKey.mockResolvedValueOnce({
      prompt: { ...unknownKey, knownFingerprint: 'SHA256:BBBBoldkey' },
    });

    render(
      <ConnectingScreen workspace={workspace} onConnected={vi.fn()} onFailed={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await screen.findByText('Host Key Changed')).toBeTruthy();
    expect(screen.getByText('SHA256:BBBBoldkey')).toBeTruthy();
    expect(screen.queryByText('Trust')).toBeNull();
    expect(screen.getByText('Trust New Key')).toBeTruthy();
  });

  it('reports a plain failure where nothing is pending', async () => {
    connect.mockRejectedValueOnce(new Error('Auth fail'));
    const onFailed = vi.fn();

    render(
      <ConnectingScreen workspace={workspace} onConnected={vi.fn()} onFailed={onFailed} onCancel={vi.fn()} />,
    );

    expect(await screen.findByText('Connection Failed')).toBeTruthy();
    await waitFor(() => expect(onFailed).toHaveBeenCalled());
    expect(screen.queryByText('Unknown Host Key')).toBeNull();
  });
});
