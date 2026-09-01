// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalManager, type TerminalSession } from './TerminalManager';
import { Ssh } from '../ssh/index';

vi.mock('../ssh/index', () => ({
  Ssh: {
    openShell: vi.fn(),
    closeShell: vi.fn(async () => {}),
    addListener: vi.fn(async () => ({ remove: async () => {} })),
  },
}));

const disconnect = vi.fn();
const attach = vi.fn();
const registerListener = vi.fn(async () => {});

vi.mock('./SshBridge', () => ({
  SshBridge: class {
    registerListener = registerListener;
    attach = attach;
    disconnect = disconnect;
  },
}));

function session(): TerminalSession {
  return {
    id: 'term-1',
    terminal: {} as TerminalSession['terminal'],
    fitAddon: {} as TerminalSession['fitAddon'],
    channelId: '',
    bridge: null,
    title: 'Terminal',
    isActive: true,
    createdAt: 0,
  };
}

describe('TerminalManager.attachShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rethrows so the view can say why the terminal is empty', async () => {
    vi.mocked(Ssh.openShell).mockRejectedValueOnce(
      new Error('Ssh.openShell() is not implemented on ios'),
    );
    const mgr = new TerminalManager();
    await expect(mgr.attachShell(session(), 'ssh-1', 80, 24)).rejects.toThrow(
      /is not implemented on/,
    );
  });

  it('drops the shellData listener it registered, so a retry does not stack one', async () => {
    vi.mocked(Ssh.openShell).mockRejectedValueOnce(new Error('nope'));
    const mgr = new TerminalManager();
    await mgr.attachShell(session(), 'ssh-1', 80, 24).catch(() => {});
    expect(registerListener).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(attach).not.toHaveBeenCalled();
  });

  it('does not register the session when the shell never opened', async () => {
    vi.mocked(Ssh.openShell).mockRejectedValueOnce(new Error('nope'));
    const mgr = new TerminalManager();
    await mgr.attachShell(session(), 'ssh-1', 80, 24).catch(() => {});
    expect(mgr.getActiveCount()).toBe(0);
    expect(mgr.getActiveSession()).toBeNull();
  });

  it('still attaches normally when the shell opens', async () => {
    vi.mocked(Ssh.openShell).mockResolvedValueOnce({ channelId: 'ch-9' });
    const mgr = new TerminalManager();
    const s = session();
    await mgr.attachShell(s, 'ssh-1', 80, 24);
    expect(s.channelId).toBe('ch-9');
    expect(attach).toHaveBeenCalledWith('ch-9');
    expect(disconnect).not.toHaveBeenCalled();
    expect(mgr.getActiveCount()).toBe(1);
  });
});

describe('TerminalManager.destroySession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes the channel it actually opened', async () => {
    vi.mocked(Ssh.openShell).mockResolvedValueOnce({ channelId: 'ch-9' });
    const mgr = new TerminalManager();
    const s = session();
    s.terminal = { dispose: vi.fn() } as unknown as TerminalSession['terminal'];
    await mgr.attachShell(s, 'ssh-1', 80, 24);
    await mgr.destroySession(s.id);
    expect(Ssh.closeShell).toHaveBeenCalledWith({ channelId: 'ch-9' });
  });

  it('does not close an empty channel id — that rejection was a second unhandled failure', async () => {
    const mgr = new TerminalManager();
    const s = session();
    s.terminal = { dispose: vi.fn() } as unknown as TerminalSession['terminal'];
    // Reach into the map the way a failed attach never does, to prove the guard.
    (mgr as unknown as { sessions: Map<string, TerminalSession> }).sessions.set(s.id, s);
    await mgr.destroySession(s.id);
    expect(Ssh.closeShell).not.toHaveBeenCalled();
  });
});
