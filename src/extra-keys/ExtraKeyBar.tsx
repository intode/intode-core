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
  { label: 'Esc', value: KEY_ESC },
  { label: 'Tab', value: KEY_TAB },
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
  // Arrow keys handled separately as dpad
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
  // Arrow keys handled separately as dpad
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
];

const ARROW_VALUES = new Set([KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT]);
const MOVE_THRESHOLD = 8;

function KeyButton({ keyDef, onPress }: { keyDef: KeyDef; onPress: (v: string) => void }) {
  const startPos = useRef<{ x: number; y: number } | null>(null);
  return (
    <button
      tabIndex={-1}
      onTouchStart={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => { e.preventDefault(); startPos.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        if (!startPos.current) return;
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        startPos.current = null;
        if (Math.sqrt(dx * dx + dy * dy) < MOVE_THRESHOLD) {
          e.preventDefault();
          onPress(keyDef.value);
        }
      }}
      onPointerCancel={() => { startPos.current = null; }}
      style={keyStyle}
    >
      {keyDef.label}
    </button>
  );
}

function DpadButton({ keyDef, onPress }: { keyDef: KeyDef; onPress: (v: string) => void }) {
  return (
    <button
      tabIndex={-1}
      onTouchStart={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => { e.preventDefault(); onPress(keyDef.value); }}
      style={dpadKeyStyle}
    >
      {keyDef.label}
    </button>
  );
}

export function ExtraKeyBar({ context, onKeyPress }: ExtraKeyBarProps) {
  const allKeys = context === 'terminal' ? TERMINAL_KEYS : context === 'code-editor' ? EDITOR_KEYS : [];
  if (allKeys.length === 0) return null;

  const otherKeys = allKeys.filter((k) => !ARROW_VALUES.has(k.value));
  const upKey = allKeys.find((k) => k.value === KEY_UP)!;
  const downKey = allKeys.find((k) => k.value === KEY_DOWN)!;
  const leftKey = allKeys.find((k) => k.value === KEY_LEFT)!;
  const rightKey = allKeys.find((k) => k.value === KEY_RIGHT)!;

  return (
    <div style={containerStyle}>
      {/* Scrollable key area */}
      <div style={scrollAreaStyle}>
        {otherKeys.map((key) => (
          <KeyButton key={key.label} keyDef={key} onPress={onKeyPress} />
        ))}
      </div>

      {/* Fixed: keyboard toggle + dpad */}
      <div style={fixedAreaStyle}>
        <DpadButton keyDef={{ label: '\u2328', value: 'keyboard' }} onPress={onKeyPress} />
        <div style={dpadStyle}>
          <div />
          <DpadButton keyDef={upKey} onPress={onKeyPress} />
          <div />
          <DpadButton keyDef={leftKey} onPress={onKeyPress} />
          <div />
          <DpadButton keyDef={rightKey} onPress={onKeyPress} />
          <div />
          <DpadButton keyDef={downKey} onPress={onKeyPress} />
          <div />
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
  maxHeight: 84,
  alignContent: 'flex-start',
};

const fixedAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  padding: 4,
  flexShrink: 0,
  borderLeft: '1px solid var(--bg-surface0)',
};

const dpadStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 30px)',
  gridTemplateRows: 'repeat(3, 26px)',
  gap: 2,
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
