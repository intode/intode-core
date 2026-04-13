import { Ssh } from '../ssh/index';
import { TransferManager } from './TransferManager';

let instance: TransferManager | null = null;
let listenerAttached = false;

function genId(): string {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function getTransferManager(): TransferManager {
  if (instance) return instance;
  instance = new TransferManager({
    sftpDownload: (o) => Ssh.sftpDownload(o),
    sftpUpload: (o) => Ssh.sftpUpload(o),
    sftpCancelTransfer: (o) => Ssh.sftpCancelTransfer(o),
    newId: genId,
  });
  if (!listenerAttached) {
    listenerAttached = true;
    Ssh.addListener('sftpTransferProgress', (ev) => {
      instance?.onProgress(ev);
    });
    // Request notification permission on first use (Android 13+); non-blocking.
    void Ssh.sftpEnsureNotificationPermission().catch(() => {});
  }
  return instance;
}
