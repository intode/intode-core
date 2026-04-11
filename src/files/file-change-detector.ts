import { Ssh, SftpEntry } from '../ssh/index';

interface CachedEntry {
  name: string;
  size: number;
  modifiedAt: number;
  isDirectory: boolean;
}

export interface DirectoryDiff {
  changed: boolean;
  entries: SftpEntry[];
}

export class FileChangeDetector {
  private cache = new Map<string, CachedEntry[]>();

  async checkDirectory(sftpId: string, path: string): Promise<DirectoryDiff> {
    const { entries } = await Ssh.sftpLs({ sftpId, path });
    const prev = this.cache.get(path);

    const current: CachedEntry[] = entries.map(e => ({
      name: e.name, size: e.size, modifiedAt: e.modifiedAt, isDirectory: e.isDirectory,
    }));

    this.cache.set(path, current);

    if (!prev) return { changed: true, entries };

    if (prev.length !== current.length) return { changed: true, entries };

    const changed = current.some((c, i) => {
      const p = prev[i];
      return c.name !== p.name || c.size !== p.size || c.modifiedAt !== p.modifiedAt || c.isDirectory !== p.isDirectory;
    });

    return { changed, entries };
  }

  invalidate(path: string): void {
    this.cache.delete(path);
  }

  clear(): void {
    this.cache.clear();
  }
}
