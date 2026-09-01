/**
 * Availability of SSH operations on the current runtime.
 *
 * This is NOT a paid feature gate. It answers "does the host implement this
 * operation at all", which is a platform fact injected by the host app.
 * Every flag defaults to true, so core running on its own is unrestricted —
 * `web.ts` implements the whole plugin contract, so the default is not a lie.
 * Never merge this with AppPolicy — that axis is billing, this one is not.
 *
 * When both a capability and a policy would block the same entry point, the
 * capability wins: hide it and do NOT offer an upgrade. Selling an upgrade for
 * something this runtime cannot do at all is a refund waiting to happen.
 *
 * Core must never learn which platforms exist. The host decides the values;
 * this module only carries them.
 */
export interface SshCapabilities {
  /** openShell / writeToShell / resizeShell / closeShell */
  shell: boolean;
  /** sftpRename / sftpCopy / sftpDelete / sftpCreateFile / sftpCreateFolder / sftpCheckRemoteExists */
  fileOps: boolean;
  /** generateSshKey / importSshKey / listSshKeys / deleteSshKey / getPublicKey */
  keyManagement: boolean;
  /** connect() actually honours the keyId argument — not a method, an argument */
  keyAuth: boolean;
  /** sftpDownload / sftpUpload / sftpDownloadBatch / sftpCancelTransfer / the four pickers
   *  / sftpCheckLocalExists / sftpEnsureNotificationPermission */
  fileTransfer: boolean;
  /** sftpDownloadToCache / sftpDeleteCache — audio and video preview only */
  mediaCache: boolean;
}

const ALL_AVAILABLE: SshCapabilities = {
  shell: true,
  fileOps: true,
  keyManagement: true,
  keyAuth: true,
  fileTransfer: true,
  mediaCache: true,
};

let current: SshCapabilities = ALL_AVAILABLE;

/**
 * Host apps call this once at bootstrap, before any UI mounts.
 *
 * Takes a partial set and merges it over the all-true default, so adding a
 * flag later never turns an existing caller's omission into `undefined`.
 * Each call replaces the previous one rather than accumulating.
 */
export function setSshCapabilities(caps: Partial<SshCapabilities>): void {
  current = { ...ALL_AVAILABLE, ...caps };
}

/** Never throws. Returns the all-true default when nothing was injected. */
export function getSshCapabilities(): SshCapabilities {
  return current;
}
