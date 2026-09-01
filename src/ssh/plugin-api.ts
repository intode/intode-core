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

/**
 * A host key that stopped a connect attempt.
 *
 * `knownFingerprint` tells the two cases apart: absent means this host has never been
 * seen before (trust-on-first-use), present means the server now offers a different key
 * than the one that was accepted earlier — either the host was rebuilt or someone is in
 * the middle of the connection.
 */
export interface HostKeyPrompt {
  host: string;
  port: number;
  /** `SHA256:<base64 without padding>`, the same shape `ssh-keygen -lf` prints. */
  fingerprint: string;
  keyType: string;
  knownFingerprint?: string;
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

export interface SftpDownloadBatchItem {
  remotePath: string;
  relativePath: string;  // path inside destination tree, including subdirs
  size: number;
}

export interface SftpDownloadBatchOptions {
  sftpId: string;
  destinationTreeUri: string;       // SAF tree URI from sftpPickDownloadDestination
  items: SftpDownloadBatchItem[];
  totalBytes: number;
  transferId: string;
  onConflict: 'overwrite' | 'rename' | 'skip';
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

  /**
   * The host key that blocked the most recent `connect`, or null.
   *
   * Takes no arguments on purpose: a jump-host chain verifies every hop, and the caller
   * has no way to know which one refused. The implementation reports the hop it stopped
   * at, so `prompt.host`/`prompt.port` may be an intermediate rather than the target.
   *
   * Platforms that do not verify host keys always answer null.
   */
  getPendingHostKey(): Promise<{ prompt: HostKeyPrompt | null }>;

  /**
   * Trust `fingerprint` for `host:port` from now on, replacing any key stored earlier.
   *
   * Pass the fingerprint back so a prompt the user answered cannot be applied to a
   * different key that arrived in between.
   */
  acceptHostKey(options: { host: string; port: number; fingerprint: string }): Promise<void>;

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

  /**
   * Runs a command on its own channel and waits for it to finish.
   *
   * `timeout` (default 30000ms) is a deadline for the whole call, not just for opening
   * the channel: once it expires the call rejects instead of waiting for the command.
   * Callers pick it to match how long they are willing to block, so an implementation
   * that only bounds the connect step silently breaks them.
   *
   * A non-zero `exitCode` is a normal result, not a rejection — `grep` with no match
   * and `... | head` (SIGPIPE) both land here.
   */
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
  sftpDownloadToCache(options: {
    sftpId: string;
    remotePath: string;
    cacheKey: string;
  }): Promise<{ localPath: string }>;
  sftpDeleteCache(options: { localPath: string }): Promise<void>;
  sftpUpload(options: SftpUploadOptions): Promise<void>;
  sftpCancelTransfer(options: { transferId: string }): Promise<void>;
  sftpCheckRemoteExists(options: { sftpId: string; paths: string[] }): Promise<{ existing: string[] }>;
  sftpRename(options: { sftpId: string; oldPath: string; newPath: string }): Promise<void>;
  sftpCopy(options: { sftpId: string; sourcePath: string; destPath: string }): Promise<void>;
  sftpDelete(options: { sftpId: string; path: string; isDirectory: boolean }): Promise<void>;
  sftpCreateFile(options: { sftpId: string; path: string }): Promise<void>;
  sftpCreateFolder(options: { sftpId: string; path: string }): Promise<void>;
  sftpPickFilesToUpload(options: { allowMultiple: boolean }): Promise<SftpPickResult>;
  sftpPickFolderToUpload(): Promise<SftpPickResult>;
  sftpPickSaveLocation(options: { suggestedName: string; mimeType?: string }): Promise<{ cancelled: boolean; localUri?: string }>;
  sftpPickDownloadDestination(): Promise<{ cancelled: boolean; treeUri?: string }>;
  sftpCheckLocalExists(options: {
    treeUri: string;
    relativePaths: string[];
  }): Promise<{ existing: string[] }>;
  sftpDownloadBatch(options: SftpDownloadBatchOptions): Promise<void>;
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
