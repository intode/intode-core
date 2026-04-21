import { Ssh } from '../ssh/index';
import { getPolicy, checkLimit } from '../policies/provider';
import { decodeBase64Utf8, encodeUtf8Base64 } from '../lib/encoding';
import { detectFileType, getFileName } from '../lib/file-utils';
import { MAX_FILE_SIZE } from '../lib/constants';

export { detectFileType } from '../lib/file-utils';

export interface FileTab {
  id: string;
  path: string;
  fileName: string;
  type: 'code' | 'markdown' | 'html';
  content: string | null;
  originalContent: string | null;
  isLoading: boolean;
  isDirty: boolean;
  scrollLine?: number;
  remoteChanged: boolean;
  lastStat: { mtime: number; size: number } | null;
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
    if (!(await checkLimit('fileTabs', this.tabs.length, maxFileTabs))) return null;

    const fileName = getFileName(path);
    const type = detectFileType(fileName);
    if (type === 'binary') return null;

    const tab: FileTab = {
      id: crypto.randomUUID(),
      path,
      fileName,
      type: type as 'code' | 'markdown' | 'html',
      content: null,
      originalContent: null,
      isLoading: true,
      isDirty: false,
      remoteChanged: false,
      lastStat: null,
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
      tab.originalContent = tab.content;
      tab.lastStat = { mtime: stat.modifiedAt, size: stat.size };
      tab.isLoading = false;
    } catch (e: unknown) {
      tab.isLoading = false;
      tab.content = `// Error reading file: ${e}`;
    }
    this.onChange?.();
    return tab;
  }

  updateContent(tabId: string, newContent: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.content = newContent;
    tab.isDirty = newContent !== tab.originalContent;
    this.onChange?.();
  }

  async saveFile(sftpId: string, tabId: string): Promise<boolean> {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || !tab.content || !tab.isDirty) return false;
    await Ssh.sftpWrite({ sftpId, path: tab.path, content: encodeUtf8Base64(tab.content) });
    tab.originalContent = tab.content;
    tab.isDirty = false;
    tab.remoteChanged = false;
    try {
      const { stat } = await Ssh.sftpStat({ sftpId, path: tab.path });
      tab.lastStat = { mtime: stat.modifiedAt, size: stat.size };
    } catch { /* stat refresh is best-effort */ }
    this.onChange?.();
    return true;
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

  /** Restore a file tab from session state — loads from SFTP or uses unsaved content */
  async restoreFile(sftpId: string, path: string, scrollLine?: number, unsavedContent?: string): Promise<FileTab | null> {
    const existing = this.tabs.find(t => t.path === path);
    if (existing) return existing;

    const fileName = getFileName(path);
    const type = detectFileType(fileName);
    if (type === 'binary') return null;

    const tab: FileTab = {
      id: crypto.randomUUID(),
      path,
      fileName,
      type: type as 'code' | 'markdown' | 'html',
      content: unsavedContent ?? null,
      originalContent: null,
      isLoading: !unsavedContent,
      isDirty: !!unsavedContent,
      scrollLine,
      remoteChanged: false,
      lastStat: null,
    };
    this.tabs.push(tab);
    this.onChange?.();

    if (!unsavedContent) {
      try {
        const { content } = await Ssh.sftpRead({ sftpId, path });
        tab.content = decodeBase64Utf8(content);
        tab.originalContent = tab.content;
        tab.isLoading = false;
        try {
          const { stat } = await Ssh.sftpStat({ sftpId, path });
          tab.lastStat = { mtime: stat.modifiedAt, size: stat.size };
        } catch { /* best-effort */ }
      } catch (e: unknown) {
        tab.isLoading = false;
        tab.content = `// Error reading file: ${e}`;
      }
      this.onChange?.();
    }
    return tab;
  }

  setScrollLine(tabId: string, line: number): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) tab.scrollLine = line;
  }

  /** Get serializable state for session persistence */
  getFileTabStates(): { path: string; scrollLine?: number; unsavedContent?: string }[] {
    return this.tabs.map(t => ({
      path: t.path,
      scrollLine: t.scrollLine,
      unsavedContent: t.isDirty && t.content ? t.content : undefined,
    }));
  }

  async checkRemoteChanges(sftpId: string): Promise<void> {
    const checks = this.tabs
      .filter(t => t.content !== null && !t.isLoading && t.lastStat)
      .map(async (tab) => {
        try {
          const { stat } = await Ssh.sftpStat({ sftpId, path: tab.path });
          const changed = stat.modifiedAt !== tab.lastStat!.mtime || stat.size !== tab.lastStat!.size;
          if (!changed) return;

          if (!tab.isDirty) {
            const { content } = await Ssh.sftpRead({ sftpId, path: tab.path });
            tab.content = decodeBase64Utf8(content);
            tab.originalContent = tab.content;
            tab.lastStat = { mtime: stat.modifiedAt, size: stat.size };
            tab.remoteChanged = false;
          } else {
            tab.remoteChanged = true;
          }
        } catch { /* file may have been deleted — ignore */ }
      });

    await Promise.all(checks);
    this.onChange?.();
  }

  async checkSingleTab(sftpId: string, tabId: string): Promise<void> {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || tab.content === null || tab.isLoading || !tab.lastStat) return;

    try {
      const { stat } = await Ssh.sftpStat({ sftpId, path: tab.path });
      const changed = stat.modifiedAt !== tab.lastStat.mtime || stat.size !== tab.lastStat.size;
      if (!changed) return;

      if (!tab.isDirty) {
        const { content } = await Ssh.sftpRead({ sftpId, path: tab.path });
        tab.content = decodeBase64Utf8(content);
        tab.originalContent = tab.content;
        tab.lastStat = { mtime: stat.modifiedAt, size: stat.size };
        tab.remoteChanged = false;
      } else {
        tab.remoteChanged = true;
      }
    } catch { /* ignore */ }

    this.onChange?.();
  }

  async reloadFile(sftpId: string, tabId: string): Promise<void> {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.isLoading = true;
    this.onChange?.();

    try {
      const { content } = await Ssh.sftpRead({ sftpId, path: tab.path });
      tab.content = decodeBase64Utf8(content);
      tab.originalContent = tab.content;
      tab.isDirty = false;
      tab.remoteChanged = false;
      try {
        const { stat } = await Ssh.sftpStat({ sftpId, path: tab.path });
        tab.lastStat = { mtime: stat.modifiedAt, size: stat.size };
      } catch { /* best-effort */ }
    } catch (e: unknown) {
      tab.content = `// Error reading file: ${e}`;
    }
    tab.isLoading = false;
    this.onChange?.();
  }

  dismissRemoteChange(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.remoteChanged = false;
    this.onChange?.();
  }
}
