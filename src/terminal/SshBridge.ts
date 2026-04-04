import type { Terminal } from '@xterm/xterm';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';

export class SshBridge {
  private dataListener: { remove: () => Promise<void> } | null = null;
  private onDataDisposable: { dispose: () => void } | null = null;
  private channelId: string | null = null;
  private compositionCleanup: (() => void) | null = null;

  constructor(private terminal: Terminal) {}

  async registerListener(): Promise<void> {
    this.dataListener = await Ssh.addListener('shellData', (event) => {
      if (!this.channelId || event.channelId !== this.channelId) return;
      try {
        const bin = atob(event.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.terminal.write(bytes);
      } catch { /* prevent propagation */ }
    });
  }

  attach(channelId: string): void {
    this.channelId = channelId;

    // Track IME composition to suppress intermediate jamo during Korean input
    let composing = false;
    const textarea = this.terminal.element?.querySelector('.xterm-helper-textarea');
    if (textarea) {
      const onStart = () => { composing = true; };
      const onEnd = () => { composing = false; };
      textarea.addEventListener('compositionstart', onStart);
      textarea.addEventListener('compositionend', onEnd);
      this.compositionCleanup = () => {
        textarea.removeEventListener('compositionstart', onStart);
        textarea.removeEventListener('compositionend', onEnd);
      };
    }

    this.onDataDisposable = this.terminal.onData((data) => {
      if (composing) return;
      try {
        Ssh.writeToShell({ channelId, data: encodeUtf8Base64(data) }).catch(() => {});
      } catch { /* prevent propagation */ }
    });
  }

  disconnect(): void {
    this.compositionCleanup?.();
    this.compositionCleanup = null;
    this.onDataDisposable?.dispose();
    this.onDataDisposable = null;
    this.dataListener?.remove();
    this.dataListener = null;
    this.channelId = null;
  }
}
