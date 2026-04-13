import type { PluginListenerHandle } from '@capacitor/core';

export interface ConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  keyId?: string;
  passphrase?: string;
  jumpHosts?: JumpHost[];
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

export type PortForwardType = 'local' | 'remote';

export interface PortForwardEntry {
  forwardId: string;
  type: PortForwardType;
  bindAddress: string;
  bindPort: number;
  targetHost: string;
  targetPort: number;
}

export interface JumpHost {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  keyId?: string;
}

export interface SftpDownloadOptions {
  sftpId: string;
  remotePath: string;
  localUri: string;   // SAF content:// URI
  transferId: string;
}

export interface SftpUploadItem {
  localUri: string;
  remoteRelativePath: string; // remoteDir 기준, dir 자체는 폴더명, 파일은 상대경로
  isDirectory: boolean;
  size: number;               // bytes, dir 은 0
}

export interface SftpUploadOptions {
  sftpId: string;
  remoteDir: string;
  items: SftpUploadItem[];
  transferId: string;
  onConflict: 'overwrite' | 'rename' | 'skip';
  totalBytes: number;
}

export interface SftpPickResult {
  cancelled: boolean;
  items: SftpUploadItem[];
  totalBytes: number;
}

export interface TransferProgressEvent {
  transferId: string;
  phase: 'start' | 'progress' | 'done' | 'error' | 'cancelled';
  bytesTransferred: number;
  totalBytes: number;        // -1 = unknown
  currentFile?: string;
  filesDone?: number;
  filesTotal?: number;
  failedFiles?: string[];
  error?: string;
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
  sftpDownload(options: SftpDownloadOptions): Promise<void>;
  sftpUpload(options: SftpUploadOptions): Promise<void>;
  sftpCancelTransfer(options: { transferId: string }): Promise<void>;
  sftpCheckRemoteExists(options: { sftpId: string; paths: string[] }): Promise<{ existing: string[] }>;
  sftpPickFilesToUpload(options: { allowMultiple: boolean }): Promise<SftpPickResult>;
  sftpPickFolderToUpload(): Promise<SftpPickResult>;
  sftpPickSaveLocation(options: { suggestedName: string; mimeType?: string }): Promise<{ cancelled: boolean; localUri?: string }>;
  sftpEnsureNotificationPermission(): Promise<{ granted: boolean }>;
  addListener(
    eventName: 'sftpTransferProgress',
    listenerFunc: (event: TransferProgressEvent) => void,
  ): Promise<PluginListenerHandle>;

  // SSH key management
  generateSshKey(options: { name: string; type: 'ed25519' | 'rsa' }): Promise<SshKey>;
  importSshKey(options: { name: string; keyData: string; passphrase?: string }): Promise<SshKey>;
  listSshKeys(): Promise<{ keys: SshKey[] }>;
  getPublicKey(options: { keyId: string }): Promise<{ publicKey: string }>;
  deleteSshKey(options: { keyId: string }): Promise<void>;

  // Port forwarding
  addPortForward(options: {
    sessionId: string;
    type: PortForwardType;
    bindAddress?: string;
    bindPort: number;
    targetHost?: string;
    targetPort: number;
  }): Promise<{ forwardId: string; bindPort: number }>;
  removePortForward(options: { forwardId: string }): Promise<void>;
  listPortForwards(options: { sessionId: string }): Promise<{ forwards: PortForwardEntry[] }>;

  addListener(
    eventName: 'shellData',
    handler: (data: { channelId: string; data: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'connectionStatus',
    handler: (data: { sessionId: string; status: ConnectionStatus }) => void
  ): Promise<PluginListenerHandle>;
}
