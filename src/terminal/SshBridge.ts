import type { Terminal } from '@xterm/xterm';
import { Ssh } from '../ssh/index';
import { debugLog } from '../lib/debug-log';

export class SshBridge {
  private dataListener: { remove: () => Promise<void> } | null = null;
  private onDataDisposable: { dispose: () => void } | null = null;
  private channelId: string | null = null;
  private dataCount = 0;

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
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          debugLog(`terminal.write ${bytes.length} bytes`);
          this.terminal.write(bytes);
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
      debugLog(`terminal.onData: ${data.length} chars → writeToShell`);
      Ssh.writeToShell({ channelId, data: btoa(data) });
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
