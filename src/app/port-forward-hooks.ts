import type { PortForwardEntry, PortForwardType } from '../ssh/plugin-api';
import type { PortForwardConfig } from '../workspace/WorkspaceManager';

export interface PortForwardHooks {
  add(sessionId: string, type: PortForwardType, bindPort: number, targetHost: string, targetPort: number, bindAddress?: string): Promise<{ forwardId: string; bindPort: number }>;
  remove(forwardId: string): Promise<void>;
  list(sessionId: string): Promise<PortForwardEntry[]>;
}

let hooks: PortForwardHooks | null = null;

export function setPortForwardHooks(h: PortForwardHooks): void {
  hooks = h;
}

export function getPortForwardHooks(): PortForwardHooks | null {
  return hooks;
}

/** Auto-start saved port forwards after connecting */
export async function autoStartPortForwards(sessionId: string, configs: PortForwardConfig[]): Promise<void> {
  if (!hooks || configs.length === 0) return;
  for (const cfg of configs) {
    try {
      await hooks.add(sessionId, cfg.type, cfg.bindPort, cfg.targetHost, cfg.targetPort);
    } catch (e) {
      console.warn(`[PortForward] Auto-start failed: :${cfg.bindPort} → ${cfg.targetHost}:${cfg.targetPort}`, e);
    }
  }
}
