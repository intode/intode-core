import type { PluginListenerHandle } from '@capacitor/core';

export interface ConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  keyId?: string;
  passphrase?: string;
}

export interface SshKey {
  id: string;
  name: string;
  type: 'ed25519' | 'rsa' | 'ecdsa';
  fingerprint: string;
  publicKey: string;
  createdAt: number;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface SftpEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  permissions: string;
}

export interface SftpStat {
  size: number;
  modifiedAt: number;
  permissions: string;
  isDirectory: boolean;
}

export interface SshPlugin {
  connect(options: ConnectOptions): Promise<{ sessionId: string }>;
  disconnect(options: { sessionId: string }): Promise<void>;
  getStatus(options: { sessionId: string }): Promise<{ status: ConnectionStatus }>;

  openShell(options: {
    sessionId: string;
    cols: number;
    rows: number;
    term?: string;
    initialPath?: string;
    tmuxSession?: string;
  }): Promise<{ channelId: string }>;
  writeToShell(options: { channelId: string; data: string }): Promise<void>;
  resizeShell(options: { channelId: string; cols: number; rows: number }): Promise<void>;
  closeShell(options: { channelId: string }): Promise<void>;

  exec(options: {
    sessionId: string;
    command: string;
    timeout?: number;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  openSftp(options: { sessionId: string }): Promise<{ sftpId: string }>;
  closeSftp(options: { sftpId: string }): Promise<void>;
  sftpLs(options: { sftpId: string; path: string }): Promise<{ entries: SftpEntry[] }>;
  sftpRead(options: { sftpId: string; path: string }): Promise<{ content: string; size: number }>;
  sftpWrite(options: { sftpId: string; path: string; content: string }): Promise<void>;
  sftpStat(options: { sftpId: string; path: string }): Promise<{ stat: SftpStat }>;

  // SSH key management
  generateSshKey(options: { name: string; type: 'ed25519' | 'rsa' }): Promise<SshKey>;
  importSshKey(options: { name: string; keyData: string; passphrase?: string }): Promise<SshKey>;
  listSshKeys(): Promise<{ keys: SshKey[] }>;
  getPublicKey(options: { keyId: string }): Promise<{ publicKey: string }>;
  deleteSshKey(options: { keyId: string }): Promise<void>;

  addListener(
    eventName: 'shellData',
    handler: (data: { channelId: string; data: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'connectionStatus',
    handler: (data: { sessionId: string; status: ConnectionStatus }) => void
  ): Promise<PluginListenerHandle>;
}
