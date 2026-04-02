import type { Terminal } from '@xterm/xterm';
import { Ssh } from '../ssh/index';

export class SshBridge {
  private dataListener: { remove: () => Promise<void> } | null = null;
  private onDataDisposable: { dispose: () => void } | null = null;
  private channelId: string | null = null;
  constructor(private terminal: Terminal) {}

  async registerListener(): Promise<void> {
    this.dataListener = await Ssh.addListener('shellData', (event) => {
      if (!this.channelId || event.channelId !== this.channelId) return;
      try {
        const bin = atob(event.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        // Uint8Array → xterm.js handles UTF-8 decoding internally (including split sequences)
        this.terminal.write(bytes);
      } catch { /* prevent propagation */ }
    });
  }

  attach(channelId: string): void {
    this.channelId = channelId;
    this.onDataDisposable = this.terminal.onData((data) => {
      try {
        const bytes = new TextEncoder().encode(data);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        Ssh.writeToShell({ channelId, data: btoa(binary) }).catch(() => {});
      } catch { /* prevent propagation */ }
    });
  }

  disconnect(): void {
    this.onDataDisposable?.dispose();
    this.onDataDisposable = null;
    this.dataListener?.remove();
    this.dataListener = null;
    this.channelId = null;
  }
}
