import { Terminal, type IBufferLine, type ILink, type ILinkProvider } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { openInPreview } from '../app/preview-hooks';
import {
  FONT_MONO,
  TERMINAL_FONT_SIZE,
  TERMINAL_LINE_HEIGHT,
  TERMINAL_SCROLLBACK,
  TERMINAL_SCROLL_SENSITIVITY,
  TERMINAL_MIN_CONTRAST_RATIO,
} from '../lib/constants';
import { getXtermTheme } from '../themes/theme-manager';
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
    theme: { ...getXtermTheme(), ...config.theme },
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const unicode11 = new Unicode11Addon();
  terminal.loadAddon(unicode11);
  terminal.unicode.activeVersion = '11';

  // Custom link provider — always underlines URLs (mobile has no hover)
  const URL_RE = /https?:\/\/[^\s'"<>\])}]+/g;

  terminal.registerLinkProvider({
    provideLinks(lineNumber: number, callback: (links: ILink[] | undefined) => void) {
      const line: IBufferLine | undefined = terminal.buffer.active.getLine(lineNumber - 1);
      if (!line) { callback(undefined); return; }
      let text = '';
      for (let i = 0; i < line.length; i++) text += line.getCell(i)?.getChars() || ' ';

      const links: ILink[] = [];
      let match: RegExpExecArray | null;
      URL_RE.lastIndex = 0;
      while ((match = URL_RE.exec(text)) !== null) {
        const startX = match.index;
        const url = match[0];
        links.push({
          range: { start: { x: startX + 1, y: lineNumber }, end: { x: startX + url.length, y: lineNumber } },
          text: url,
          decorations: { underline: true, pointerCursor: true },
          activate: () => {
            try {
              const parsed = new URL(url);
              const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0';
              if (isLocal && openInPreview(url)) return;
            } catch { /* invalid URL */ }
            window.open(url, '_blank');
          },
        });
      }
      callback(links.length > 0 ? links : undefined);
    },
  } as ILinkProvider);

  // Canvas renderer — WebGL disabled (crashes on CJK glyph rendering)

  return { terminal, fitAddon };
}
