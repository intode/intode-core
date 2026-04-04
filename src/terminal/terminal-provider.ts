/** DI hook for native terminal rendering — Pro injects Android/iOS native terminal provider at bootstrap */

export interface NativeTerminalProvider {
  createTerminal(terminalId: string, sessionId: string, defaultPath?: string, tmuxSession?: string): Promise<void>;
  destroyTerminal(terminalId: string): Promise<void>;
  showTerminal(terminalId: string, rect: { x: number; y: number; width: number; height: number }): Promise<void>;
  hideTerminal(terminalId: string): Promise<void>;
  resizeTerminal(terminalId: string, rect: { x: number; y: number; width: number; height: number }): Promise<void>;
  writeInput(terminalId: string, data: string): Promise<void>;
  focusTerminal(terminalId: string): Promise<void>;
  setFontSize(terminalId: string, size: number): Promise<void>;
  isAvailable(): boolean;
}

let provider: NativeTerminalProvider | null = null;

export function setNativeTerminalProvider(p: NativeTerminalProvider): void { provider = p; }
export function getNativeTerminalProvider(): NativeTerminalProvider | null { return provider; }
export function hasNativeTerminal(): boolean { return provider?.isAvailable() ?? false; }
