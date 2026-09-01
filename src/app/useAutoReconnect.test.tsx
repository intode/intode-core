// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor, act } from '@testing-library/react';

// vi.mock is hoisted above the imports, so the double has to be hoisted with it.
const Ssh = vi.hoisted(() => ({
  getStatus: vi.fn(),
  disconnect: vi.fn(async () => {}),
  connect: vi.fn(async () => ({ sessionId: 'new-session' })),
  openSftp: vi.fn(async () => ({ sftpId: 'new-sftp' })),
}));
vi.mock('../ssh/index', () => ({ Ssh }));

import { useAutoReconnect } from './useAutoReconnect';
import { setWorkspaceStore } from '../workspace/WorkspaceManager';
import type { Workspace, WorkspaceStore } from '../workspace/WorkspaceManager';
import type { ConnectedWorkspace } from './types';

const workspace: Workspace = {
  id: 'ws1', name: 'ws1', host: 'h', port: 22, username: 'u', authType: 'password',
  defaultPath: '~', lastConnectedAt: null, createdAt: 0, updatedAt: 0, sortOrder: 0,
};

const connection: ConnectedWorkspace = {
  wsId: 'ws1', workspace, sessionId: 'old-session', sftpId: 'old-sftp', sftpError: null,
};

const store = {
  getPassword: async () => 'pw',
  getJumpHostPasswords: async () => [],
} as unknown as WorkspaceStore;

/** Mount the hook and fire the visibilitychange it listens on. */
async function becomeVisible(conns: ConnectedWorkspace[]) {
  const setConnections = vi.fn();
  renderHook(() => useAutoReconnect(conns, setConnections));
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  return setConnections;
}

beforeEach(() => {
  setWorkspaceStore(store);
  Ssh.getStatus.mockReset();
  Ssh.disconnect.mockClear();
  Ssh.connect.mockClear();
  Ssh.openSftp.mockClear();
});
afterEach(cleanup);

describe('useAutoReconnect', () => {
  it('leaves a connected session alone', async () => {
    Ssh.getStatus.mockResolvedValue({ status: 'connected' });
    const setConnections = await becomeVisible([connection]);

    expect(Ssh.disconnect).not.toHaveBeenCalled();
    expect(Ssh.connect).not.toHaveBeenCalled();
    expect(setConnections).not.toHaveBeenCalled();
  });

  it('releases the dead session before opening a new one', async () => {
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    await becomeVisible([connection]);

    await waitFor(() => expect(Ssh.connect).toHaveBeenCalled());
    expect(Ssh.disconnect).toHaveBeenCalledWith({ sessionId: 'old-session' });
    expect(Ssh.disconnect.mock.invocationCallOrder[0])
      .toBeLessThan(Ssh.connect.mock.invocationCallOrder[0]);
  });

  it('reconnects even when the disconnect fails — the old session may be gone already', async () => {
    Ssh.getStatus.mockResolvedValue({ status: 'error' });
    Ssh.disconnect.mockRejectedValueOnce(new Error('Session not found'));
    await becomeVisible([connection]);

    await waitFor(() => expect(Ssh.connect).toHaveBeenCalled());
  });

  it('does not disconnect when the status probe itself failed', async () => {
    // A probe that threw is not proof of death. Disconnecting here would take a live
    // session's shell channels and port forwards down with it.
    Ssh.getStatus.mockRejectedValue(new Error('bridge error'));
    await becomeVisible([connection]);

    await waitFor(() => expect(Ssh.connect).toHaveBeenCalled());
    expect(Ssh.disconnect).not.toHaveBeenCalled();
  });

  it('ignores the event while the document is hidden', async () => {
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await becomeVisible([connection]);

    expect(Ssh.getStatus).not.toHaveBeenCalled();
    expect(Ssh.disconnect).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
