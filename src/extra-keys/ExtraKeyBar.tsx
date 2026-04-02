import React, { useState, useCallback } from 'react';
import {
  KEY_ESC, KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT,
  CTRL_CODE_A, CTRL_CODE_Z, CTRL_OFFSET,
  DOUBLE_TAP_THRESHOLD_MS,
} from '../lib/constants';
import { NO_TAP_HIGHLIGHT, TOUCH_SCROLL } from '../lib/styles';

export type ExtraKeysContext = 'terminal' | 'code-editor' | 'md-editor';
type ModifierState = 'inactive' | 'active' | 'locked';

export interface ExtraKeyBarProps {
  context: ExtraKeysContext;
  onKeyPress: (data: string) => void;
}

interface KeyDef {
  label: string;
  value: string;
  type: 'key' | 'modifier';
  modifier?: 'ctrl' | 'alt';
}

const TERMINAL_KEYS: KeyDef[] = [
  { label: 'Esc', value: KEY_ESC, type: 'key' },
  { label: 'Ctrl', value: '', type: 'modifier', modifier: 'ctrl' },
  { label: 'Alt', value: '', type: 'modifier', modifier: 'alt' },
  { label: 'Tab', value: KEY_TAB, type: 'key' },
  { label: '\u2191', value: KEY_UP, type: 'key' },
  { label: '\u2193', value: KEY_DOWN, type: 'key' },
  { label: '\u2190', value: KEY_LEFT, type: 'key' },
  { label: '\u2192', value: KEY_RIGHT, type: 'key' },
  { label: '~', value: '~', type: 'key' },
  { label: '/', value: '/', type: 'key' },
  { label: '|', value: '|', type: 'key' },
];

const EDITOR_KEYS: KeyDef[] = [
  { label: 'Tab', value: 'tab', type: 'key' },
  { label: 'Undo', value: 'undo', type: 'key' },
  { label: 'Redo', value: 'redo', type: 'key' },
  { label: 'Save', value: 'save', type: 'key' },
  { label: '\u2191', value: KEY_UP, type: 'key' },
  { label: '\u2193', value: KEY_DOWN, type: 'key' },
  { label: '\u2190', value: KEY_LEFT, type: 'key' },
  { label: '\u2192', value: KEY_RIGHT, type: 'key' },
  { label: '{', value: '{', type: 'key' },
  { label: '}', value: '}', type: 'key' },
  { label: '(', value: '(', type: 'key' },
  { label: ')', value: ')', type: 'key' },
];

export function ExtraKeyBar({ context, onKeyPress }: ExtraKeyBarProps) {
  const [ctrlState, setCtrlState] = useState<ModifierState>('inactive');
  const [altState, setAltState] = useState<ModifierState>('inactive');
  const [lastCtrlTap, setLastCtrlTap] = useState(0);
  const [lastAltTap, setLastAltTap] = useState(0);

  const keys = context === 'terminal' ? TERMINAL_KEYS : context === 'code-editor' ? EDITOR_KEYS : [];
  if (keys.length === 0) return null;

  const handleModifierTap = useCallback(
    (modifier: 'ctrl' | 'alt') => {
      const now = Date.now();
      const isCtrl = modifier === 'ctrl';
      const state = isCtrl ? ctrlState : altState;
      const setState = isCtrl ? setCtrlState : setAltState;
      const lastTap = isCtrl ? lastCtrlTap : lastAltTap;
      const setLastTap = isCtrl ? setLastCtrlTap : setLastAltTap;

      if (state === 'locked') {
        setState('inactive');
      } else if (state === 'active' && now - lastTap < DOUBLE_TAP_THRESHOLD_MS) {
        setState('locked');
      } else if (state === 'inactive') {
        setState('active');
      } else {
        setState('inactive');
      }
      setLastTap(now);
    },
    [ctrlState, altState, lastCtrlTap, lastAltTap],
  );

  const handleKeyPress = useCallback(
    (key: KeyDef) => {
      if (key.type === 'modifier' && key.modifier) {
        handleModifierTap(key.modifier);
        return;
      }

      let data = key.value;

      if (context === 'terminal') {
        if (ctrlState !== 'inactive' && data.length === 1) {
          const code = data.toUpperCase().charCodeAt(0);
          if (code >= CTRL_CODE_A && code <= CTRL_CODE_Z) {
            data = String.fromCharCode(code - CTRL_OFFSET);
          }
        }
        if (altState !== 'inactive') {
          data = KEY_ESC + data;
        }
      }

      onKeyPress(data);

      if (ctrlState === 'active') setCtrlState('inactive');
      if (altState === 'active') setAltState('inactive');
    },
    [context, ctrlState, altState, onKeyPress, handleModifierTap],
  );

  return (
    <div style={styles.bar}>
      {keys.map((key) => {
        const isCtrlKey = key.modifier === 'ctrl';
        const isAltKey = key.modifier === 'alt';
        const modState = isCtrlKey ? ctrlState : isAltKey ? altState : 'inactive';

        return (
          <button
            key={key.label}
            onPointerDown={(e) => {
              e.preventDefault();
              handleKeyPress(key);
            }}
            style={{
              ...styles.key,
              ...(modState === 'active' ? styles.keyActive : {}),
              ...(modState === 'locked' ? styles.keyLocked : {}),
            }}
          >
            {key.label}
          </button>
        );
      })}
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
  keyActive: {
    backgroundColor: 'var(--accent-blue)',
    color: 'var(--bg-base)',
  } as React.CSSProperties,
  keyLocked: {
    backgroundColor: 'var(--accent-blue)',
    color: 'var(--bg-base)',
    textDecoration: 'underline',
  } as React.CSSProperties,
};
