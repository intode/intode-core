import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileTabManager } from './TabManager';

vi.mock('../ssh/index', () => ({
  Ssh: {
    sftpStat: vi.fn(),
    sftpRead: vi.fn(),
    sftpWrite: vi.fn(),
    sftpDownloadToCache: vi.fn(),
    sftpDeleteCache: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    convertFileSrc: (p: string) => `https://localhost/_capacitor_file_${p}`,
  },
}));

vi.mock('../policies/provider', () => ({
  getPolicy: () => ({ maxFileTabs: 100 }),
  checkLimit: async () => true,
}));

import { Ssh } from '../ssh/index';
import { setSshCapabilities } from '../ssh/capabilities';
import { getNotices, dismissNotice } from '../ui/notice';

describe('FileTabManager — media branch', () => {
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;
  let createCalls: number;
  let revokeCalls: string[];

  beforeEach(() => {
    createCalls = 0;
    revokeCalls = [];
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => `blob:mock-${++createCalls}`);
    URL.revokeObjectURL = vi.fn((u: string) => { revokeCalls.push(u); });
    vi.mocked(Ssh.sftpStat).mockReset();
    vi.mocked(Ssh.sftpRead).mockReset();
    vi.mocked(Ssh.sftpDownloadToCache).mockReset();
    vi.mocked(Ssh.sftpDeleteCache).mockReset();
    vi.mocked(Ssh.sftpStat).mockResolvedValue({ stat: { size: 1024, modifiedAt: 1, permissions: '', isDirectory: false } });
    // base64 for bytes [1,2,3,4]
    vi.mocked(Ssh.sftpRead).mockResolvedValue({ content: 'AQIDBA==', size: 4 });
    vi.mocked(Ssh.sftpDownloadToCache).mockResolvedValue({ localPath: '/cache/intode-media/file' });
    vi.mocked(Ssh.sftpDeleteCache).mockResolvedValue(undefined);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('opens a PNG as type=media kind=image with a blob URL', async () => {
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/photo.png');
    expect(tab).not.toBeNull();
    expect(tab!.type).toBe('media');
    expect(tab!.mediaKind).toBe('image');
    expect(tab!.blobUrl).toBe('blob:mock-1');
    expect(tab!.content).toBe('blob:mock-1');
  });

  it('opens an mp4 as type=media kind=video via cache path (not blob)', async () => {
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/clip.mp4');
    expect(tab!.mediaKind).toBe('video');
    expect(tab!.cachePath).toBe('/cache/intode-media/file');
    expect(tab!.blobUrl).toContain('https://localhost/_capacitor_file_');
    expect(Ssh.sftpRead).not.toHaveBeenCalled();
    expect(Ssh.sftpDownloadToCache).toHaveBeenCalled();
  });

  it('marks too-large media as TOO_LARGE without reading content', async () => {
    vi.mocked(Ssh.sftpStat).mockResolvedValueOnce({
      stat: { size: 60 * 1024 * 1024, modifiedAt: 1, permissions: '', isDirectory: false },
    });
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/huge.png');
    expect(tab!.content).toMatch(/^__TOO_LARGE__:/);
    expect(tab!.blobUrl).toBeUndefined();
    expect(Ssh.sftpRead).not.toHaveBeenCalled();
  });

  it('uses 100MB cap for audio', async () => {
    vi.mocked(Ssh.sftpStat).mockResolvedValueOnce({
      stat: { size: 80 * 1024 * 1024, modifiedAt: 1, permissions: '', isDirectory: false },
    });
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/song.mp3');
    expect(tab!.cachePath).toBeTruthy();
  });

  it('rejects audio above 100MB cap', async () => {
    vi.mocked(Ssh.sftpStat).mockResolvedValueOnce({
      stat: { size: 120 * 1024 * 1024, modifiedAt: 1, permissions: '', isDirectory: false },
    });
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/big.mp3');
    expect(tab!.content).toMatch(/^__TOO_LARGE__:/);
    expect(Ssh.sftpRead).not.toHaveBeenCalled();
  });

  it('uses 500MB cap for video', async () => {
    vi.mocked(Ssh.sftpStat).mockResolvedValueOnce({
      stat: { size: 400 * 1024 * 1024, modifiedAt: 1, permissions: '', isDirectory: false },
    });
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/clip.mp4');
    expect(tab!.cachePath).toBeTruthy();
  });

  it('rejects video above 500MB cap', async () => {
    vi.mocked(Ssh.sftpStat).mockResolvedValueOnce({
      stat: { size: 600 * 1024 * 1024, modifiedAt: 1, permissions: '', isDirectory: false },
    });
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/big.mp4');
    expect(tab!.content).toMatch(/^__TOO_LARGE__:/);
  });

  it('revokes blob URL when closing image tab', async () => {
    const mgr = new FileTabManager();
    const tab = (await mgr.openFile('s', '/r/photo.png'))!;
    mgr.closeTab(tab.id);
    expect(revokeCalls).toContain('blob:mock-1');
  });

  it('deletes cache file when closing audio/video tab', async () => {
    const mgr = new FileTabManager();
    const tab = (await mgr.openFile('s', '/r/clip.mp4'))!;
    mgr.closeTab(tab.id);
    expect(Ssh.sftpDeleteCache).toHaveBeenCalledWith({ localPath: '/cache/intode-media/file' });
  });
});

describe('FileTabManager — media without a cache-capable runtime', () => {
  beforeEach(() => {
    vi.mocked(Ssh.sftpStat).mockReset();
    vi.mocked(Ssh.sftpRead).mockReset();
    vi.mocked(Ssh.sftpDownloadToCache).mockReset();
    vi.mocked(Ssh.sftpStat).mockResolvedValue({ stat: { size: 1024, modifiedAt: 1, permissions: '', isDirectory: false } });
    vi.mocked(Ssh.sftpRead).mockResolvedValue({ content: 'AQIDBA==', size: 4 });
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    setSshCapabilities({ mediaCache: false });
    for (const n of getNotices()) dismissNotice(n.id);
  });

  afterEach(() => {
    setSshCapabilities({});
    for (const n of getNotices()) dismissNotice(n.id);
  });

  it('opens no tab for video and says why, without naming an OS', async () => {
    const mgr = new FileTabManager();
    expect(await mgr.openFile('s', '/r/clip.mp4')).toBeNull();
    expect(mgr.getTabs()).toHaveLength(0);
    expect(Ssh.sftpDownloadToCache).not.toHaveBeenCalled();

    const [notice] = getNotices();
    expect(notice.title).toBe('Media preview is not available on this platform');
    expect(notice.title).not.toMatch(/\bios\b|android|Ssh\./i);
  });

  it('opens no tab for audio either', async () => {
    const mgr = new FileTabManager();
    expect(await mgr.openFile('s', '/r/song.mp3')).toBeNull();
  });

  it('still opens images, which never touch the cache', async () => {
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/photo.png');
    expect(tab).not.toBeNull();
    expect(tab!.mediaKind).toBe('image');
    expect(getNotices()).toHaveLength(0);
  });

  it('still opens ordinary files', async () => {
    const mgr = new FileTabManager();
    const tab = await mgr.openFile('s', '/r/main.ts');
    expect(tab).not.toBeNull();
    expect(tab!.type).toBe('code');
  });
});
