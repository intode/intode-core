import { registerPlugin } from '@capacitor/core';
import type { SshPlugin } from './plugin-api';

export const Ssh = registerPlugin<SshPlugin>('Ssh');
export type { SshPlugin, ConnectOptions, ConnectionStatus, SftpEntry, SftpStat } from './plugin-api';
