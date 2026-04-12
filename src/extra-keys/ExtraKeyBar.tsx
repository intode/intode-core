import React, { useRef } from 'react';
import {
  KEY_ESC, KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT,
} from '../lib/constants';
import { NO_TAP_HIGHLIGHT } from '../lib/styles';

export type ExtraKeysContext = 'terminal' | 'code-editor' | 'md-editor';

export interface ExtraKeyBarProps {
  context: ExtraKeysContext;
  onKeyPress: (data: string) => void;
}

interface KeyDef {
  label: string;
  value: string;
}

const TERMINAL_KEYS: KeyDef[] = [
  { label: 'Snip', value: 'snippets' },
  { label: 'Esc', value: KEY_ESC },
  { label: 'Tab', value: KEY_TAB },
  { label: 'S-Tab', value: '\x1b[Z' },
  { label: 'C-c', value: '\x03' },
  { label: 'C-d', value: '\x04' },
  { label: 'C-z', value: '\x1a' },
  { label: 'C-a', value: '\x01' },
  { label: 'C-l', value: '\x0c' },
  { label: 'C-b', value: '\x02' },
  { label: '~', value: '~' },
  { label: '/', value: '/' },
  { label: '|', value: '|' },
  { label: '-', value: '-' },
  { label: '_', value: '_' },
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
];

const EDITOR_KEYS: KeyDef[] = [
  { label: 'Save', value: 'save' },
  { label: 'Undo', value: 'undo' },
  { label: 'Redo', value: 'redo' },
  { label: 'Tab', value: 'tab' },
  { label: '{', value: '{' },
  { label: '}', value: '}' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: '[', value: '[' },
  { label: ']', value: ']' },
  { label: '"', value: '"' },
  { label: "'", value: "'" },
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
];

const MD_KEYS: KeyDef[] = [
  { label: 'Save', value: 'save' },
  { label: 'Undo', value: 'undo' },
  { label: 'Redo', value: 'redo' },
  { label: '#', value: 'md:heading' },
  { label: 'B', value: 'md:bold' },
  { label: 'I', value: 'md:italic' },
  { label: '```', value: 'md:code' },
  { label: '-', value: 'md:list' },
  { label: '>', value: 'md:quote' },
  { label: '[]', value: 'md:link' },
  { label: '![]', value: 'md:image' },
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
];

const ARROW_VALUES = new Set([KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT]);

/** Restore focus + native keyboard if a text input was focused before button press. */
function restoreFocus(el: HTMLElement | null) {
  if (!el) return;
  if (document.activeElement !== el) el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    (window as any).__intodeShowKeyboard?.();
  }
}

const MOVE_THRESHOLD = 8;

function KeyButton({ keyDef, onPress }: { keyDef: KeyDef; onPress: (v: string) => void }) {
  const prevFocus = useRef<HTMLElement | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  return (
    <button
      tabIndex={-1}
      onTouchStart={(e) => {
        e.preventDefault();
        const t = e.touches[0];
        startPos.current = { x: t.clientX, y: t.clientY };
        moved.current = false;
        prevFocus.current = document.activeElement as HTMLElement | null;
      }}
      onTouchMove={(e) => {
        if (moved.current || !startPos.current) return;
        const t = e.touches[0];
        const dx = t.clientX - startPos.current.x;
        const dy = t.clientY - startPos.current.y;
        if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
          moved.current = true;
        }
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        if (!moved.current) {
          onPress(keyDef.value);
          restoreFocus(prevFocus.current);
        }
        prevFocus.current = null;
        startPos.current = null;
      }}
      style={keyStyle}
    >
      {keyDef.label}
    </button>
  );
}

const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 80;

function DpadButton({ keyDef, onPress }: { keyDef: KeyDef; onPress: (v: string) => void }) {
  const prevFocus = useRef<HTMLElement | null>(null);
  const repeatTimer = useRef<number | null>(null);

  const stopRepeat = () => {
    if (repeatTimer.current !== null) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  return (
    <button
      tabIndex={-1}
      onTouchStart={(e) => {
        e.preventDefault();
        prevFocus.current = document.activeElement as HTMLElement | null;
        onPress(keyDef.value);
        stopRepeat();
        const timeout = window.setTimeout(() => {
          repeatTimer.current = window.setInterval(() => onPress(keyDef.value), REPEAT_INTERVAL);
        }, REPEAT_DELAY);
        repeatTimer.current = timeout as unknown as number;
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        stopRepeat();
        restoreFocus(prevFocus.current);
        prevFocus.current = null;
      }}
      style={dpadKeyStyle}
    >
      {keyDef.label}
    </button>
  );
}

export function ExtraKeyBar({ context, onKeyPress }: ExtraKeyBarProps) {
  const allKeys = context === 'terminal' ? TERMINAL_KEYS : context === 'md-editor' ? MD_KEYS : context === 'code-editor' ? EDITOR_KEYS : [];
  if (allKeys.length === 0) return null;

  const otherKeys = allKeys.filter((k) => !ARROW_VALUES.has(k.value));
  const upKey = allKeys.find((k) => k.value === KEY_UP)!;
  const downKey = allKeys.find((k) => k.value === KEY_DOWN)!;
  const leftKey = allKeys.find((k) => k.value === KEY_LEFT)!;
  const rightKey = allKeys.find((k) => k.value === KEY_RIGHT)!;

  return (
    <div style={containerStyle}>
      <div style={scrollAreaStyle}>
        {otherKeys.map((key) => (
          <KeyButton key={key.label} keyDef={key} onPress={onKeyPress} />
        ))}
      </div>

      <div style={fixedAreaStyle}>
        <div style={dpadWithEnterStyle}>
          <div style={dpadStyle}>
            <div />
            <DpadButton keyDef={upKey} onPress={onKeyPress} />
            <div />
            <DpadButton keyDef={leftKey} onPress={onKeyPress} />
            <DpadButton keyDef={downKey} onPress={onKeyPress} />
            <DpadButton keyDef={rightKey} onPress={onKeyPress} />
          </div>
          <div style={enterWrapStyle}>
            <DpadButton keyDef={{ label: '\u23ce', value: '\r' }} onPress={onKeyPress} />
          </div>
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  backgroundColor: 'var(--bg-crust)',
  borderTop: '2px solid var(--bg-surface0)',
  flexShrink: 0,
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 3,
  padding: 6,
  overflowY: 'auto',
  maxHeight: 64,
  alignContent: 'flex-start',
};

const fixedAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 3,
  padding: 4,
  flexShrink: 0,
  borderLeft: '1px solid var(--bg-surface0)',
};

const dpadStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 36px)',
  gridTemplateRows: 'repeat(2, 32px)',
  gap: 2,
};

const dpadWithEnterStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: 2,
};

const enterWrapStyle: React.CSSProperties = {
  width: 44,
  alignSelf: 'stretch',
};

const keyStyle: React.CSSProperties = {
  flexShrink: 0,
  minWidth: 40,
  height: 34,
  border: '1px solid var(--bg-surface1)',
  borderRadius: 2,
  backgroundColor: 'var(--bg-mantle)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  touchAction: 'manipulation',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...NO_TAP_HIGHLIGHT,
};


const dpadKeyStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  border: '1px solid var(--bg-surface1)',
  borderRadius: 2,
  backgroundColor: 'var(--bg-mantle)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  touchAction: 'manipulation',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  ...NO_TAP_HIGHLIGHT,
};
