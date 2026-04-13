import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferManager } from './TransferManager';
import type { TransferProgressEvent } from '../ssh/plugin-api';

function makeDeps() {
  return {
    sftpDownload: vi.fn().mockResolvedValue(undefined),
    sftpUpload: vi.fn().mockResolvedValue(undefined),
    sftpCancelTransfer: vi.fn().mockResolvedValue(undefined),
    newId: (() => {
      let n = 0;
      return () => `t${++n}`;
    })(),
  };
}

describe('TransferManager', () => {
  let deps: ReturnType<typeof makeDeps>;
  let mgr: TransferManager;

  beforeEach(() => {
    deps = makeDeps();
    mgr = new TransferManager(deps);
  });

  it('startDownload assigns id and registers state', () => {
    const id = mgr.startDownload({ sftpId: 's', remotePath: '/r/foo', localUri: 'content://x', label: 'foo' });
    expect(id).toBe('t1');
    expect(mgr.getState(id)?.phase).toBe('start');
    expect(deps.sftpDownload).toHaveBeenCalledWith(expect.objectContaining({ transferId: 't1' }));
  });

  it('applies progress events', () => {
    const id = mgr.startDownload({ sftpId: 's', remotePath: '/r/foo', localUri: 'u', label: 'foo' });
    const ev: TransferProgressEvent = { transferId: id, phase: 'progress', bytesTransferred: 500, totalBytes: 1000 };
    mgr.onProgress(ev);
    expect(mgr.getState(id)).toMatchObject({ phase: 'progress', bytesTransferred: 500, totalBytes: 1000 });
  });

  it('cancel calls native and updates state', async () => {
    const id = mgr.startDownload({ sftpId: 's', remotePath: '/r/foo', localUri: 'u', label: 'foo' });
    await mgr.cancel(id);
    expect(deps.sftpCancelTransfer).toHaveBeenCalledWith({ transferId: id });
    mgr.onProgress({ transferId: id, phase: 'cancelled', bytesTransferred: 0, totalBytes: 0 });
    expect(mgr.getState(id)?.phase).toBe('cancelled');
  });

  it('notifies subscribers on state change', () => {
    const sub = vi.fn();
    mgr.subscribe(sub);
    mgr.startDownload({ sftpId: 's', remotePath: '/r/foo', localUri: 'u', label: 'foo' });
    expect(sub).toHaveBeenCalled();
  });

  it('limits concurrent transfers to 3, queues rest', () => {
    for (let i = 0; i < 5; i++) {
      mgr.startDownload({ sftpId: 's', remotePath: `/r/f${i}`, localUri: `u${i}`, label: `f${i}` });
    }
    expect(deps.sftpDownload).toHaveBeenCalledTimes(3);
    expect(mgr.getQueueLength()).toBe(2);
  });

  it('ignores progress events after terminal phase', () => {
    const id = mgr.startDownload({ sftpId: 's', remotePath: '/r/foo', localUri: 'u', label: 'foo' });
    mgr.onProgress({ transferId: id, phase: 'done', bytesTransferred: 100, totalBytes: 100 });
    mgr.onProgress({ transferId: id, phase: 'progress', bytesTransferred: 50, totalBytes: 100 });
    expect(mgr.getState(id)?.phase).toBe('done');
    expect(mgr.getState(id)?.bytesTransferred).toBe(100);
  });

  it('starts queued transfer after one completes', () => {
    for (let i = 0; i < 4; i++) {
      mgr.startDownload({ sftpId: 's', remotePath: `/r/f${i}`, localUri: `u${i}`, label: `f${i}` });
    }
    expect(deps.sftpDownload).toHaveBeenCalledTimes(3);
    mgr.onProgress({ transferId: 't1', phase: 'done', bytesTransferred: 100, totalBytes: 100 });
    expect(deps.sftpDownload).toHaveBeenCalledTimes(4);
    expect(mgr.getQueueLength()).toBe(0);
  });
});
