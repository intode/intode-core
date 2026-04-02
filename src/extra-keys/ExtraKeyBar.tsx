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
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
  { label: '~', value: '~' },
  { label: '/', value: '/' },
  { label: '|', value: '|' },
  { label: '-', value: '-' },
  { label: '_', value: '_' },
];

const EDITOR_KEYS: KeyDef[] = [
  { label: 'Save', value: 'save' },
  { label: 'Undo', value: 'undo' },
  { label: 'Redo', value: 'redo' },
  { label: 'Tab', value: 'tab' },
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
  { label: '{', value: '{' },
  { label: '}', value: '}' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: '[', value: '[' },
  { label: ']', value: ']' },
  { label: '"', value: '"' },
  { label: "'", value: "'" },
];

const MOVE_THRESHOLD = 8;

function KeyButton({ keyDef, onPress }: { keyDef: KeyDef; onPress: (v: string) => void }) {
  const startPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <button
      onPointerDown={(e) => {
        startPos.current = { x: e.clientX, y: e.clientY };
      }}
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

export function ExtraKeyBar({ context, onKeyPress }: ExtraKeyBarProps) {
  const keys = context === 'terminal' ? TERMINAL_KEYS : context === 'code-editor' ? EDITOR_KEYS : [];
  if (keys.length === 0) return null;

  return (
    <div style={barStyle}>
      {keys.map((key) => (
        <KeyButton key={key.label} keyDef={key} onPress={onKeyPress} />
      ))}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 3,
  padding: '6px',
  backgroundColor: 'var(--bg-crust)',
  borderTop: '2px solid var(--bg-surface0)',
  flexShrink: 0,
  overflowY: 'auto',
  maxHeight: 84,
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
  fontFamily: 'Chakra Petch',
  fontWeight: 700,
  cursor: 'pointer',
  touchAction: 'manipulation',
  textTransform: 'uppercase' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...NO_TAP_HIGHLIGHT,
};
