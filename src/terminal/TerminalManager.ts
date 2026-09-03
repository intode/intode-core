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
    if (!(await checkLimit('terminals', this.sessions.size, maxTerminals))) return null;

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
  ): Promise<void> {
    // Register listener BEFORE openShell to avoid race condition
    // (Kotlin read thread starts immediately on channel.connect)
    const bridge = new SshBridge(session.terminal);
    await bridge.registerListener();

    let channelId: string;
    try {
      ({ channelId } = await Ssh.openShell({
        sessionId: sshSessionId,
        cols,
        rows,
        initialPath,
      }));
    } catch (e) {
      // Without this the rejection escaped as an unhandled promise rejection and
      // the tab kept its chrome — tab strip, extra key bar — around an empty
      // body with no error anywhere. Drop the listener we just registered so a
      // retry does not stack a second one, and let the caller render the reason.
      bridge.disconnect();
      throw e;
    }

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
    // channelId stays empty when attachShell failed before openShell resolved.
    // Closing "" makes the runtime reject, which turned a failed attach into a
    // second unhandled rejection on teardown.
    if (session.channelId) {
      try {
        await Ssh.closeShell({ channelId: session.channelId });
      } catch {
        // Disconnecting a workspace closes the SSH session first and only then drops it
        // from state, so React unmounts the terminal and reaches this line with a channel
        // the native side has already torn down. That rejection is expected, and it must
        // not stop the teardown: everything below is local cleanup.
        //
        // Letting it escape leaked the session into `this.sessions` permanently — nothing
        // awaits or catches this call, so it vanished as an unhandled rejection. The free
        // tier counts those slots against `maxTerminals`, which meant a second disconnect
        // made every later connect open the "Limit Reached" dialog with no way back.
      }
    }
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
