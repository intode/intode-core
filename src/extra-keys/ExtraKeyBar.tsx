import React from 'react';
import {
  KEY_ESC, KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT,
} from '../lib/constants';
import { NO_TAP_HIGHLIGHT, TOUCH_SCROLL } from '../lib/styles';

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
  { label: '\u2191', value: KEY_UP },
  { label: '\u2193', value: KEY_DOWN },
  { label: '\u2190', value: KEY_LEFT },
  { label: '\u2192', value: KEY_RIGHT },
  { label: '~', value: '~' },
  { label: '/', value: '/' },
  { label: '|', value: '|' },
  { label: '-', value: '-' },
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
];

export function ExtraKeyBar({ context, onKeyPress }: ExtraKeyBarProps) {
  const keys = context === 'terminal' ? TERMINAL_KEYS : context === 'code-editor' ? EDITOR_KEYS : [];
  if (keys.length === 0) return null;

  return (
    <div style={styles.bar}>
      {keys.map((key) => (
        <button
          key={key.label}
          onPointerDown={(e) => {
            e.preventDefault();
            onKeyPress(key.value);
          }}
          style={styles.key}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    gap: 4,
    padding: '4px 6px',
    backgroundColor: 'var(--bg-crust)',
    borderTop: '1px solid var(--bg-surface0)',
    overflowX: 'auto',
    flexShrink: 0,
    ...TOUCH_SCROLL,
  } as React.CSSProperties,
  key: {
    flexShrink: 0,
    minWidth: 36,
    height: 32,
    border: 'none',
    borderRadius: 4,
    backgroundColor: 'var(--bg-surface0)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    touchAction: 'manipulation',
    ...NO_TAP_HIGHLIGHT,
  } as React.CSSProperties,
};
