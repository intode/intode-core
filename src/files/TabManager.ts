import { Ssh } from '../ssh/index';
import { getPolicy, checkLimit } from '../policies/provider';
import { decodeBase64Utf8 } from '../lib/encoding';
import { detectFileType, getFileName } from '../lib/file-utils';
import { MAX_FILE_SIZE } from '../lib/constants';

export { detectFileType } from '../lib/file-utils';

export interface FileTab {
  id: string;
  path: string;
  fileName: string;
  type: 'code' | 'markdown';
  content: string | null;
  isLoading: boolean;
}

export class FileTabManager {
  private tabs: FileTab[] = [];
  private activeTabId: string | null = null;
  private onChange: (() => void) | null = null;

  setOnChange(fn: () => void): void { this.onChange = fn; }

  async openFile(sftpId: string, path: string): Promise<FileTab | null> {
    const existing = this.tabs.find(t => t.path === path);
    if (existing) {
      this.activeTabId = existing.id;
      this.onChange?.();
      return existing;
    }

    const { maxFileTabs } = getPolicy();
    if (!checkLimit('fileTabs', this.tabs.length, maxFileTabs)) return null;

    const fileName = getFileName(path);
    const type = detectFileType(fileName);
    if (type === 'binary') return null;

    const tab: FileTab = {
      id: crypto.randomUUID(),
      path,
      fileName,
      type: type as 'code' | 'markdown',
      content: null,
      isLoading: true,
    };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.onChange?.();

    try {
      const { stat } = await Ssh.sftpStat({ sftpId, path });
      if (stat.size > MAX_FILE_SIZE) {
        tab.isLoading = false;
        tab.content = '// File too large (>10MB). Use terminal to view.';
        this.onChange?.();
        return tab;
      }

      const { content } = await Ssh.sftpRead({ sftpId, path });
      tab.content = decodeBase64Utf8(content);
      tab.isLoading = false;
    } catch (e: unknown) {
      tab.isLoading = false;
      tab.content = `// Error reading file: ${e}`;
    }
    this.onChange?.();
    return tab;
  }

  getActiveTab(): FileTab | null {
    if (!this.activeTabId) return null;
    return this.tabs.find(t => t.id === this.activeTabId) ?? null;
  }

  getTabs(): FileTab[] {
    return this.tabs;
  }

  setActiveTab(id: string): void {
    this.activeTabId = id;
    this.onChange?.();
  }

  closeTab(id: string): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabId === id) {
      this.activeTabId = this.tabs[Math.min(idx, this.tabs.length - 1)]?.id ?? null;
    }
    this.onChange?.();
  }
}
