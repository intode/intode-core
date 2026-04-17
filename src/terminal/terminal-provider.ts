/** DI hook for native terminal rendering — Pro injects Android/iOS native terminal provider at bootstrap */

export interface SwipeListenerHandle {
  remove(): void;
}

export interface TerminalSwipeEvent {
  direction: 'next' | 'prev';
  terminalId: string;
}

export interface NativeTerminalProvider {
  createTerminal(terminalId: string, sessionId: string, defaultPath?: string, tmuxSession?: string): Promise<void>;
  destroyTerminal(terminalId: string): Promise<void>;
  showTerminal(terminalId: string, rect: { x: number; y: number; width: number; height: number }): Promise<void>;
  hideTerminal(terminalId: string): Promise<void>;
  resizeTerminal(terminalId: string, rect: { x: number; y: number; width: number; height: number }): Promise<void>;
  writeInput(terminalId: string, data: string): Promise<void>;
  focusTerminal(terminalId: string, options?: { showKeyboard?: boolean }): Promise<void>;
  setFontSize(terminalId: string, size: number): Promise<void>;
  isAvailable(): boolean;
  /** Optional — only implemented on platforms that support native swipe detection */
  addSwipeListener?(cb: (e: TerminalSwipeEvent) => void): Promise<SwipeListenerHandle>;
  /** Optional — sticky Ctrl modifier that applies to the next physical/IME key */
  setControlKey?(terminalId: string, armed: boolean): Promise<void>;
  /** Fires when the armed Ctrl was consumed by a key event so UI can clear its pressed state */
  addControlKeyListener?(cb: (e: { terminalId: string; armed: boolean }) => void): Promise<SwipeListenerHandle>;
}

let provider: NativeTerminalProvider | null = null;

export function setNativeTerminalProvider(p: NativeTerminalProvider): void { provider = p; }
export function getNativeTerminalProvider(): NativeTerminalProvider | null { return provider; }
export function hasNativeTerminal(): boolean { return provider?.isAvailable() ?? false; }
