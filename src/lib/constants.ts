// === Font ===
export const FONT_MONO = '"Fira Code", "Source Code Pro", "Menlo", monospace, "Noto Sans CJK KR", sans-serif';

// === Terminal ===
export const TERMINAL_FONT_SIZE = 14;
export const TERMINAL_LINE_HEIGHT = 1.2;
export const TERMINAL_SCROLLBACK = 1000;
export const TERMINAL_SCROLL_SENSITIVITY = 3;
export const TERMINAL_MIN_CONTRAST_RATIO = 4.5;

// === Pinch Zoom ===
export const PINCH_ZOOM_MIN = 8;
export const PINCH_ZOOM_MAX = 32;

// === SSH ===
export const DEFAULT_SSH_PORT = 22;
export const SSH_CONNECT_TIMEOUT_MS = 10000;
export const DEFAULT_TERM_TYPE = 'xterm-256color';

// === File ===
export const MAX_FILE_SIZE = 10_485_760; // 10MB

// === Timing ===
export const DOUBLE_TAP_THRESHOLD_MS = 300;
export const LONG_PRESS_DELAY_MS = 500;
export const COPY_FEEDBACK_MS = 2000;
export const MOCK_DELAY_MS = 500;
export const UPGRADE_CLOSE_DELAY_MS = 1200;

// === ANSI Keys ===
export const KEY_ESC = '\x1b';
export const KEY_TAB = '\t';
export const KEY_UP = '\x1b[A';
export const KEY_DOWN = '\x1b[B';
export const KEY_LEFT = '\x1b[D';
export const KEY_RIGHT = '\x1b[C';

// === Ctrl Key Conversion ===
export const CTRL_CODE_A = 65;
export const CTRL_CODE_Z = 90;
export const CTRL_OFFSET = 64;

// === Catppuccin Mocha — xterm.js Theme ===
export const XTERM_THEME = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  selectionBackground: '#45475a',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#cba6f7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
} as const;

export const XTERM_LIGHT_THEME = {
  background: '#f5f5f5',
  foreground: '#1a1a1a',
  cursor: '#0066cc',
  selectionBackground: '#0066cc33',
  black: '#1a1a1a',
  red: '#dc3545',
  green: '#28a745',
  yellow: '#e6a817',
  blue: '#0066cc',
  magenta: '#6f42c1',
  cyan: '#17a2b8',
  white: '#e0e0e0',
  brightBlack: '#555555',
  brightRed: '#dc3545',
  brightGreen: '#28a745',
  brightYellow: '#e6a817',
  brightBlue: '#0066cc',
  brightMagenta: '#6f42c1',
  brightCyan: '#17a2b8',
  brightWhite: '#f5f5f5',
} as const;
