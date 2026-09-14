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
const hooks = vi.hoisted(() => ({
  keepAliveStart: vi.fn(),
  autoStartPortForwards: vi.fn(async () => {}),
}));
vi.mock('./keepalive-hooks', () => ({ keepAliveStart: hooks.keepAliveStart }));
vi.mock('./port-forward-hooks', () => ({ autoStartPortForwards: hooks.autoStartPortForwards }));

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
  hooks.keepAliveStart.mockClear();
  hooks.autoStartPortForwards.mockClear();
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

describe('reconnect()', () => {
  /** Mount the hook without firing visibilitychange, so only the explicit call runs. */
  function mountControls(conns: ConnectedWorkspace[]) {
    const setConnections = vi.fn();
    const { result } = renderHook(() => useAutoReconnect(conns, setConnections));
    return { controls: result.current, setConnections };
  }

  it('releases the dead session and connects a new one', async () => {
    const { controls, setConnections } = mountControls([connection]);

    await act(async () => { await controls.reconnect('ws1'); });

    expect(Ssh.disconnect).toHaveBeenCalledWith({ sessionId: 'old-session' });
    expect(Ssh.connect).toHaveBeenCalled();
    expect(setConnections).toHaveBeenCalled();
  });

  it('never asks getStatus — the caller already knows it is dead', async () => {
    // On a half-open socket getStatus answers `connected`, which is the whole reason the
    // banner exists. Consulting it here would refuse to reconnect exactly when it matters.
    const { controls } = mountControls([connection]);

    await act(async () => { await controls.reconnect('ws1'); });

    expect(Ssh.getStatus).not.toHaveBeenCalled();
  });

  it('does nothing for a workspace that is no longer connected', async () => {
    const { controls } = mountControls([connection]);

    await act(async () => { await controls.reconnect('ws-gone'); });

    expect(Ssh.disconnect).not.toHaveBeenCalled();
    expect(Ssh.connect).not.toHaveBeenCalled();
  });

  it('propagates a failed connect so the banner can stay up', async () => {
    Ssh.connect.mockRejectedValueOnce(new Error('host unreachable'));
    const { controls } = mountControls([connection]);

    await expect(
      act(async () => { await controls.reconnect('ws1'); }),
    ).rejects.toThrow('host unreachable');
  });
});

describe('after a reconnect', () => {
  it('restarts the background keep-alive', async () => {
    // A session that died or was paused in the background may have taken the keep-alive
    // service down with it; nothing else starts it again for the new session.
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    await becomeVisible([connection]);

    await waitFor(() => expect(hooks.keepAliveStart).toHaveBeenCalled());
    expect(hooks.keepAliveStart.mock.invocationCallOrder[0])
      .toBeGreaterThan(Ssh.connect.mock.invocationCallOrder[0]);
  });

  it('restarts it without asking for permission', async () => {
    // Every return that reconnects would otherwise raise the notification prompt again, for a
    // user who already declined it — and the native terminal view can cover that prompt.
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    await becomeVisible([connection]);

    await waitFor(() => expect(hooks.keepAliveStart).toHaveBeenCalledWith({ askPermission: false }));
  });

  it('restores the saved port forwards on the new session', async () => {
    const forwards = [{ id: 'pf1', type: 'local' as const, bindPort: 3000, targetHost: 'localhost', targetPort: 3000 }];
    const withForwards: ConnectedWorkspace = {
      ...connection,
      workspace: { ...workspace, portForwards: forwards },
    };
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    await becomeVisible([withForwards]);

    await waitFor(() => expect(hooks.autoStartPortForwards).toHaveBeenCalledWith('new-session', forwards));
  });

  it('does not start forwards for a workspace without any', async () => {
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    await becomeVisible([connection]);

    await waitFor(() => expect(hooks.keepAliveStart).toHaveBeenCalled());
    expect(hooks.autoStartPortForwards).not.toHaveBeenCalled();
  });
});

describe('concurrent reconnects', () => {
  it('a tap on the banner during the automatic reconnect does not open a second session', async () => {
    let finishConnect: (v: { sessionId: string }) => void = () => {};
    Ssh.connect.mockImplementationOnce(() => new Promise((resolve) => { finishConnect = resolve; }));
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    const setConnections = vi.fn();
    const { result } = renderHook(() => useAutoReconnect([connection], setConnections));

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(Ssh.connect).toHaveBeenCalledTimes(1));

    let tapped: Promise<void> = Promise.resolve();
    await act(async () => { tapped = result.current.reconnect('ws1'); });
    await act(async () => { finishConnect({ sessionId: 'new-session' }); await tapped; });

    expect(Ssh.connect).toHaveBeenCalledTimes(1);
  });

  it('the sweep skips a workspace that got a new session while its status was checked', async () => {
    let answerStatus: (v: { status: 'disconnected' }) => void = () => {};
    Ssh.getStatus.mockImplementationOnce(() => new Promise((resolve) => { answerStatus = resolve; }));
    const setConnections = vi.fn();
    const { result, rerender } = renderHook(
      ({ conns }) => useAutoReconnect(conns, setConnections),
      { initialProps: { conns: [connection] } },
    );

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await result.current.reconnect('ws1'); });
    expect(Ssh.connect).toHaveBeenCalledTimes(1);

    rerender({ conns: [{ ...connection, sessionId: 'new-session', sftpId: 'new-sftp' }] });
    await act(async () => { answerStatus({ status: 'disconnected' }); });

    expect(Ssh.connect).toHaveBeenCalledTimes(1);
    expect(Ssh.disconnect).not.toHaveBeenCalledWith({ sessionId: 'new-session' });
  });
});

describe('a workspace disconnected while its reconnect is in flight', () => {
  it('closes the session that arrives late and does not restart the keep-alive', async () => {
    let finishConnect: (v: { sessionId: string }) => void = () => {};
    Ssh.connect.mockImplementationOnce(() => new Promise((resolve) => { finishConnect = resolve; }));
    Ssh.getStatus.mockResolvedValue({ status: 'disconnected' });
    const setConnections = vi.fn();
    const withForwards: ConnectedWorkspace = {
      ...connection,
      workspace: { ...workspace, portForwards: [{ id: 'pf1', type: 'local', bindPort: 3000, targetHost: 'localhost', targetPort: 3000 }] },
    };
    const { rerender } = renderHook(
      ({ conns }) => useAutoReconnect(conns, setConnections),
      { initialProps: { conns: [withForwards] } },
    );

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(Ssh.connect).toHaveBeenCalledTimes(1));

    // The user disconnects the workspace from the list (or halts it) before connect returns.
    rerender({ conns: [] });
    Ssh.disconnect.mockClear();
    await act(async () => { finishConnect({ sessionId: 'late-session' }); });

    await waitFor(() => expect(Ssh.disconnect).toHaveBeenCalledWith({ sessionId: 'late-session' }));
    expect(hooks.keepAliveStart).not.toHaveBeenCalled();
    expect(hooks.autoStartPortForwards).not.toHaveBeenCalled();
    expect(setConnections).not.toHaveBeenCalled();
  });
});
