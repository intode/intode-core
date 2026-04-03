import type { PortForwardEntry, PortForwardType } from '../ssh/plugin-api';

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
