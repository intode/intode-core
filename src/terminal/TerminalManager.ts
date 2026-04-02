import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { createTerminal } from './Terminal';
import { SshBridge } from './SshBridge';
import { Ssh } from '../ssh/index';
import { getPolicy, checkLimit } from '../policies/provider';

export interface TerminalSession {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  channelId: string;
  bridge: SshBridge | null;
  title: string;
  isActive: boolean;
  createdAt: number;
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private activeSessionId: string | null = null;

  async createSession(sshSessionId: string): Promise<TerminalSession | null> {
    const { maxTerminals } = getPolicy();
    if (!checkLimit('terminals', this.sessions.size, maxTerminals)) return null;

    const { terminal, fitAddon } = createTerminal();
    const id = crypto.randomUUID();

    return {
      id,
      terminal,
      fitAddon,
      channelId: '',
      bridge: null,
      title: 'Terminal',
      isActive: true,
      createdAt: Date.now(),
    };
  }

  async attachShell(
    session: TerminalSession,
    sshSessionId: string,
    cols: number,
    rows: number,
    initialPath?: string,
    tmuxSession?: string,
  ): Promise<void> {
    // Register listener BEFORE openShell to avoid race condition
    // (Kotlin read thread starts immediately on channel.connect)
    const bridge = new SshBridge(session.terminal);
    await bridge.registerListener();

    const { channelId } = await Ssh.openShell({
      sessionId: sshSessionId,
      cols,
      rows,
      initialPath,
      tmuxSession,
    });

    session.channelId = channelId;
    session.bridge = bridge;
    bridge.attach(channelId);

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
  }

  switchTo(sessionId: string): void {
    for (const [id, s] of this.sessions) {
      s.isActive = id === sessionId;
    }
    this.activeSessionId = sessionId;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.bridge?.disconnect();
    await Ssh.closeShell({ channelId: session.channelId });
    session.terminal.dispose();
    this.sessions.delete(sessionId);

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.sessions.keys().next().value ?? null;
    }
  }

  getActiveSession(): TerminalSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  getActiveCount(): number {
    return this.sessions.size;
  }
}
