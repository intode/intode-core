import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import {
  FONT_MONO,
  TERMINAL_FONT_SIZE,
  TERMINAL_LINE_HEIGHT,
  TERMINAL_SCROLLBACK,
  TERMINAL_SCROLL_SENSITIVITY,
  TERMINAL_MIN_CONTRAST_RATIO,
  XTERM_THEME,
} from '../lib/constants';
import '@xterm/xterm/css/xterm.css';

export interface TerminalConfig {
  fontSize?: number;
  scrollback?: number;
  theme?: Record<string, string>;
}

export function createTerminal(config: TerminalConfig = {}): {
  terminal: Terminal;
  fitAddon: FitAddon;
} {
  const terminal = new Terminal({
    fontFamily: FONT_MONO,
    fontSize: config.fontSize ?? TERMINAL_FONT_SIZE,
    lineHeight: TERMINAL_LINE_HEIGHT,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: config.scrollback ?? TERMINAL_SCROLLBACK,
    scrollSensitivity: TERMINAL_SCROLL_SENSITIVITY,
    allowTransparency: false,
    allowProposedApi: true,
    minimumContrastRatio: TERMINAL_MIN_CONTRAST_RATIO,
    convertEol: false,
    theme: { ...XTERM_THEME, ...config.theme },
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const unicode11 = new Unicode11Addon();
  terminal.loadAddon(unicode11);
  terminal.unicode.activeVersion = '11';

  terminal.loadAddon(new WebLinksAddon());

  // Canvas renderer — WebGL disabled (crashes on CJK glyph rendering)

  return { terminal, fitAddon };
}
