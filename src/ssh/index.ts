import { registerPlugin } from '@capacitor/core';
import type { SshPlugin } from './plugin-api';

export const Ssh = registerPlugin<SshPlugin>('Ssh', {
  web: () => import('./web').then((m) => new m.SshWeb()),
});
export type { SshPlugin, ConnectOptions, ConnectionStatus, SftpEntry, SftpStat, SshKey } from './plugin-api';
