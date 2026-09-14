import React, { useRef, useState, useEffect } from 'react';
import {
  KEY_ESC, KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT,
} from '../lib/constants';
import { NO_TAP_HIGHLIGHT } from '../lib/styles';
import { getNativeTerminalProvider } from '../terminal/terminal-provider';
import { getActiveNativeTerminal } from '../terminal/active-terminal';
import { applyModifiers } from './modifiers';

export type ExtraKeysContext = 'terminal' | 'code-editor' | 'md-editor';

export interface ExtraKeyBarProps {
  context: ExtraKeysContext;
  onKeyPress: (data: string) => void;
}

interface KeyDef {
  label: string;
  value: string;
}

const CTRL_TOGGLE_VALUE = 'ctrl-toggle';
const SHIFT_TOGGLE_VALUE = 'shift-toggle';

/** Opens a picker instead of sending bytes, so it must not consume an armed modifier. */
const SNIPPETS_VALUE = 'snippets';

const TERMINAL_KEYS: KeyDef[] = [
  { label: 'Snip', value: SNIPPETS_VALUE },
  { label: 'Esc', value: KEY_ESC },
  { label: 'Tab', value: KEY_TAB },
  { label: 'Shift', value: SHIFT_TOGGLE_VALUE },
  { label: 'Ctrl', value: CTRL_TOGGLE_VALUE },
  { label: 'C-c', value: '\x03' },
  { label: 'C-o', value: '\x0f' },
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

function KeyButton({ keyDef, onPress, active }: { keyDef: KeyDef; onPress: (v: string) => void; active?: boolean }) {
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
      style={active ? { ...keyStyle, ...activeKeyStyle } : keyStyle}
    >
      {keyDef.label}
    </button>
  );
}

const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 80;

function DpadButton({ keyDef, onPress, resolve }: {
  keyDef: KeyDef;
  onPress: (v: string) => void;
  /** Applies and consumes the armed modifiers, returning the bytes to send. */
  resolve: (v: string) => string;
}) {
  const prevFocus = useRef<HTMLElement | null>(null);
  const repeatTimer = useRef<number | null>(null);

  const stopRepeat = () => {
    if (repeatTimer.current !== null) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  // A held key must never outlive its button: once the timer escapes, it sends a key every
  // REPEAT_INTERVAL down the SSH connection for as long as the app runs, background included.
  useEffect(() => stopRepeat, []);

  const endPress = () => {
    stopRepeat();
    restoreFocus(prevFocus.current);
    prevFocus.current = null;
  };

  return (
    <button
      tabIndex={-1}
      onTouchStart={(e) => {
        e.preventDefault();
        prevFocus.current = document.activeElement as HTMLElement | null;
        // Resolve once and repeat that: consuming the modifier per tick would send
        // e.g. one shift+up followed by a stream of plain ups while the key is held.
        const value = resolve(keyDef.value);
        onPress(value);
        stopRepeat();
        const timeout = window.setTimeout(() => {
          repeatTimer.current = window.setInterval(() => onPress(value), REPEAT_INTERVAL);
        }, REPEAT_DELAY);
        repeatTimer.current = timeout as unknown as number;
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        endPress();
      }}
      // The system cancels the touch instead of ending it when it takes the gesture over —
      // edge back swipe, notification shade, a scroll starting under the finger. No touchend
      // follows, so this is the only chance to stop the repeat.
      onTouchCancel={endPress}
      style={dpadKeyStyle}
    >
      {keyDef.label}
    </button>
  );
}

export function ExtraKeyBar({ context, onKeyPress }: ExtraKeyBarProps) {
  const allKeys = context === 'terminal' ? TERMINAL_KEYS : context === 'md-editor' ? MD_KEYS : context === 'code-editor' ? EDITOR_KEYS : [];
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const [shiftArmed, setShiftArmed] = useState(false);
  // Read while resolving a press: setState is async, but a D-pad touchStart both
  // consumes and sends within the same tick.
  const ctrlArmedRef = useRef(false);
  const shiftArmedRef = useRef(false);

  /**
   * Ctrl is mirrored onto the native view as well: while armed there, the next key
   * event from the soft or hardware keyboard picks it up (that is how C-r, C-x etc.
   * are reachable without a dedicated button).
   */
  const armCtrl = (next: boolean) => {
    ctrlArmedRef.current = next;
    setCtrlArmed(next);
    const provider = getNativeTerminalProvider();
    const activeId = getActiveNativeTerminal();
    if (provider?.setControlKey && activeId) {
      provider.setControlKey(activeId, next).catch(() => {});
    }
  };

  /**
   * Shift stays in JS. Soft keyboards already have a Shift of their own, and the only
   * thing a native sticky Shift would add is upper-casing the next typed character —
   * for which SwiftTerm exposes no hook, so it would be an Android-only method.
   */
  const armShift = (next: boolean) => {
    shiftArmedRef.current = next;
    setShiftArmed(next);
  };

  // Listen for native auto-clear when armed Ctrl is consumed by a key event
  useEffect(() => {
    if (context !== 'terminal') return;
    const provider = getNativeTerminalProvider();
    if (!provider?.addControlKeyListener) return;
    let handle: { remove(): void } | null = null;
    let cancelled = false;
    provider.addControlKeyListener((e) => {
      if (e.armed) return;
      ctrlArmedRef.current = false;
      setCtrlArmed(false);
    }).then((h) => {
      if (cancelled) { h.remove(); return; }
      handle = h;
    }).catch(() => {});
    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [context]);

  /**
   * Apply the armed modifiers to a key that is about to be sent, consuming them.
   *
   * Clearing Ctrl here also clears it natively — otherwise Ctrl + a bar key would send
   * the combination *and* leave Ctrl armed to swallow the next character typed.
   */
  const resolveKey = (value: string): string => {
    if (value === SNIPPETS_VALUE) return value;
    const mods = { ctrl: ctrlArmedRef.current, shift: shiftArmedRef.current };
    if (!mods.ctrl && !mods.shift) return value;
    if (mods.ctrl) armCtrl(false);
    if (mods.shift) armShift(false);
    return applyModifiers(value, mods);
  };

  const handlePress = (value: string) => {
    if (value === CTRL_TOGGLE_VALUE) {
      armCtrl(!ctrlArmedRef.current);
      return;
    }
    if (value === SHIFT_TOGGLE_VALUE) {
      armShift(!shiftArmedRef.current);
      return;
    }
    onKeyPress(resolveKey(value));
  };

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
          <KeyButton
            key={key.label}
            keyDef={key}
            onPress={handlePress}
            active={(key.value === CTRL_TOGGLE_VALUE && ctrlArmed)
              || (key.value === SHIFT_TOGGLE_VALUE && shiftArmed)}
          />
        ))}
      </div>

      <div style={fixedAreaStyle}>
        <div style={dpadWithEnterStyle}>
          <div style={dpadStyle}>
            <div />
            <DpadButton keyDef={upKey} onPress={onKeyPress} resolve={resolveKey} />
            <div />
            <DpadButton keyDef={leftKey} onPress={onKeyPress} resolve={resolveKey} />
            <DpadButton keyDef={downKey} onPress={onKeyPress} resolve={resolveKey} />
            <DpadButton keyDef={rightKey} onPress={onKeyPress} resolve={resolveKey} />
          </div>
          <div style={enterWrapStyle}>
            <DpadButton keyDef={{ label: '\u23ce', value: '\r' }} onPress={onKeyPress} resolve={resolveKey} />
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

// Declares `border` rather than `borderColor`: keyStyle sets the shorthand, and mixing the
// two makes React leave the old border behind when the armed state clears.
const activeKeyStyle: React.CSSProperties = {
  backgroundColor: 'var(--accent-green, #00ff66)',
  color: 'var(--bg-base, #0a0e13)',
  border: '1px solid var(--accent-green, #00ff66)',
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
