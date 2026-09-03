import { useCallback, useEffect, useRef } from 'react';
import { Ssh } from '../ssh/index';
import { getWorkspaceStore } from '../workspace/WorkspaceManager';
import type { ConnectOptions } from '../ssh/plugin-api';
import type { ConnectedWorkspace } from './types';

/**
 * Replaces one workspace's dead session with a fresh one.
 *
 * Exported through the hook rather than directly so that both callers — the automatic
 * foreground sweep and the user tapping the disconnected banner — go through exactly the
 * same path. Two implementations of "reconnect" would drift.
 *
 * Throws if the connect fails, so a caller that is showing UI can keep showing it.
 */
async function reconnectWorkspace(
  conn: ConnectedWorkspace,
  setConnections: React.Dispatch<React.SetStateAction<ConnectedWorkspace[]>>,
): Promise<void> {
  const connectOpts: ConnectOptions = {
    host: conn.workspace.host,
    port: conn.workspace.port,
    username: conn.workspace.username,
  };
  if (conn.workspace.authType === 'key' && conn.workspace.keyId) {
    connectOpts.keyId = conn.workspace.keyId;
  } else {
    const password = await getWorkspaceStore().getPassword(conn.wsId);
    connectOpts.password = password ?? undefined;
  }
  if (conn.workspace.jumpHosts && conn.workspace.jumpHosts.length > 0) {
    const jumpPasswords = await getWorkspaceStore().getJumpHostPasswords(conn.wsId);
    connectOpts.jumpHosts = conn.workspace.jumpHosts.map((jh, i) => ({
      host: jh.host, port: jh.port, username: jh.username, authType: jh.authType,
      keyId: jh.keyId, password: jumpPasswords[i] ?? undefined,
    }));
  }
  const { sessionId } = await Ssh.connect(connectOpts);
  let sftpId: string | null = null;
  try {
    const res = await Ssh.openSftp({ sessionId });
    sftpId = res.sftpId;
  } catch { /* sftp optional */ }

  setConnections((prev) =>
    prev.map((c) => (c.wsId === conn.wsId ? { ...c, sessionId, sftpId, sftpError: null } : c)),
  );
}

/** Frees a session known to be dead, along with everything hanging off its transport. */
async function releaseSession(sessionId: string): Promise<void> {
  // The native side frees the transport and its dependents (jump-host intermediates, local
  // forward listeners, SFTP channels); without this every foreground return stacked one more.
  try {
    await Ssh.disconnect({ sessionId });
  } catch {
    /* already gone — nothing left to release */
  }
}

export interface AutoReconnectControls {
  /**
   * Reconnects one workspace on demand — what the disconnected banner calls.
   *
   * Unlike the automatic sweep this does not first ask `getStatus`: the caller already knows
   * the session is dead, and on a half-open socket `getStatus` answers `connected` anyway
   * (that false answer is why the banner exists).
   */
  reconnect(wsId: string): Promise<void>;
}

/**
 * Watches visibilitychange and reconnects dead SSH sessions transparently, and exposes the
 * same reconnect for UI that asks for it explicitly.
 *
 * Uses a ref to avoid re-registering the listener on every connections change.
 */
export function useAutoReconnect(
  connections: ConnectedWorkspace[],
  setConnections: React.Dispatch<React.SetStateAction<ConnectedWorkspace[]>>,
): AutoReconnectControls {
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== 'visible') return;
      const conns = connectionsRef.current;
      if (conns.length === 0) return;

      for (const conn of conns) {
        // Only a definitive non-connected answer authorizes tearing the old session down.
        // A probe that threw is not proof of death, and disconnecting a live session would
        // take its shell channels and port forwards with it.
        let staleSessionId: string | null = null;
        try {
          const { status } = await Ssh.getStatus({ sessionId: conn.sessionId });
          if (status === 'connected') continue;
          staleSessionId = conn.sessionId;
        } catch {
          /* status check failed — assume dead, but leave the old session alone */
        }

        if (staleSessionId) {
          await releaseSession(staleSessionId);
        }

        try {
          await reconnectWorkspace(conn, setConnections);
        } catch {
          /* reconnect failed — the terminal banner offers a manual retry */
        }
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const reconnect = useCallback(async (wsId: string) => {
    const conn = connectionsRef.current.find((c) => c.wsId === wsId);
    if (!conn) return;
    await releaseSession(conn.sessionId);
    await reconnectWorkspace(conn, setConnections);
  }, [setConnections]);

  return { reconnect };
}
