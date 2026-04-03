import { useEffect, useRef } from 'react';
import { Ssh } from '../ssh/index';
import { getWorkspaceStore } from '../workspace/WorkspaceManager';
import type { ConnectOptions } from '../ssh/plugin-api';
import type { ConnectedWorkspace } from './types';

/**
 * Watches visibilitychange and reconnects dead SSH sessions transparently.
 * Uses a ref to avoid re-registering the listener on every connections change.
 */
export function useAutoReconnect(
  connections: ConnectedWorkspace[],
  setConnections: React.Dispatch<React.SetStateAction<ConnectedWorkspace[]>>,
) {
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== 'visible') return;
      const conns = connectionsRef.current;
      if (conns.length === 0) return;

      for (const conn of conns) {
        try {
          const { status } = await Ssh.getStatus({ sessionId: conn.sessionId });
          if (status === 'connected') continue;
        } catch {
          /* status check failed — assume dead */
        }

        try {
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
        } catch {
          /* reconnect failed — user will see dead terminal */
        }
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
}
