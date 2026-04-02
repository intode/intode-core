import type { Terminal } from '@xterm/xterm';
import { Ssh } from '../ssh/index';
import { debugLog } from '../lib/debug-log';

export class SshBridge {
  private dataListener: { remove: () => Promise<void> } | null = null;
  private onDataDisposable: { dispose: () => void } | null = null;
  private channelId: string | null = null;
  private dataCount = 0;
  private decoder = new TextDecoder('utf-8');

  constructor(private terminal: Terminal) {}

  async registerListener(): Promise<void> {
    debugLog('SshBridge: registering shellData listener');
    this.dataListener = await Ssh.addListener('shellData', (event) => {
      this.dataCount++;
      const match = this.channelId && event.channelId === this.channelId;
      debugLog(`shellData #${this.dataCount} match=${match} len=${event.data?.length ?? 0}`);
      if (match) {
        try {
          const binaryStr = atob(event.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          // TextDecoder: UTF-8 → string (Korean safe), stream handles split sequences
          const text = this.decoder.decode(bytes, { stream: true });
          debugLog(`terminal.write ${text.length}ch cols=${this.terminal.cols} rows=${this.terminal.rows}`);
          this.terminal.write(text);
        } catch (e) {
          debugLog(`decode error: ${e}`);
        }
      }
    });
    debugLog('SshBridge: listener registered');
  }

  attach(channelId: string): void {
    this.channelId = channelId;
    debugLog(`SshBridge: attached channelId=${channelId}`);
    this.onDataDisposable = this.terminal.onData((data) => {
      const hex = Array.from(data).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      debugLog(`onData ${data.length}ch [${hex}] → write`);
      // Encode as UTF-8 bytes then base64 (btoa only supports Latin1)
      const bytes = new TextEncoder().encode(data);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      Ssh.writeToShell({ channelId, data: btoa(binary) }).then((r: any) => {
        if (r?.diag) debugLog(`write ok: ${r.diag}`);
      }).catch((e: any) => debugLog(`write err: ${e}`));
    });
  }

  disconnect(): void {
    debugLog('SshBridge: disconnect');
    this.onDataDisposable?.dispose();
    this.onDataDisposable = null;
    this.dataListener?.remove();
    this.dataListener = null;
    this.channelId = null;
  }
}
