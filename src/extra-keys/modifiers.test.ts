import { describe, it, expect } from 'vitest';
import { applyModifiers } from './modifiers';
import { KEY_ESC, KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT } from '../lib/constants';

const NONE = { ctrl: false, shift: false };
const SHIFT = { ctrl: false, shift: true };
const CTRL = { ctrl: true, shift: false };
const BOTH = { ctrl: true, shift: true };

describe('applyModifiers', () => {
  it('leaves everything alone when nothing is armed', () => {
    for (const value of [KEY_ESC, KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, '\r', '/', '_', '~', '|', '-']) {
      expect(applyModifiers(value, NONE)).toBe(value);
    }
  });

  it('encodes arrows with the xterm modifier parameter', () => {
    expect(applyModifiers(KEY_UP, SHIFT)).toBe('\x1b[1;2A');
    expect(applyModifiers(KEY_DOWN, SHIFT)).toBe('\x1b[1;2B');
    expect(applyModifiers(KEY_RIGHT, SHIFT)).toBe('\x1b[1;2C');
    expect(applyModifiers(KEY_LEFT, SHIFT)).toBe('\x1b[1;2D');

    expect(applyModifiers(KEY_UP, CTRL)).toBe('\x1b[1;5A');
    expect(applyModifiers(KEY_LEFT, CTRL)).toBe('\x1b[1;5D');
    expect(applyModifiers(KEY_RIGHT, CTRL)).toBe('\x1b[1;5C');

    expect(applyModifiers(KEY_UP, BOTH)).toBe('\x1b[1;6A');
  });

  it('sends back-tab for shift+tab, and plain tab for ctrl+tab', () => {
    expect(applyModifiers(KEY_TAB, SHIFT)).toBe('\x1b[Z');
    expect(applyModifiers(KEY_TAB, BOTH)).toBe('\x1b[Z');
    expect(applyModifiers(KEY_TAB, CTRL)).toBe(KEY_TAB);
  });

  it('sends ESC CR for shift+enter, and plain CR for ctrl+enter', () => {
    expect(applyModifiers('\r', SHIFT)).toBe('\x1b\r');
    expect(applyModifiers('\r', BOTH)).toBe('\x1b\r');
    expect(applyModifiers('\r', CTRL)).toBe('\r');
  });

  it('maps ctrl+/ and ctrl+_ to 0x1f, and leaves shift on them alone', () => {
    expect(applyModifiers('/', CTRL)).toBe('\x1f');
    expect(applyModifiers('_', CTRL)).toBe('\x1f');
    expect(applyModifiers('/', BOTH)).toBe('\x1f');
    expect(applyModifiers('/', SHIFT)).toBe('/');
  });

  it('passes through keys that have no standard modified sequence', () => {
    for (const mods of [SHIFT, CTRL, BOTH]) {
      expect(applyModifiers(KEY_ESC, mods)).toBe(KEY_ESC);
      expect(applyModifiers('~', mods)).toBe('~');
      expect(applyModifiers('|', mods)).toBe('|');
      expect(applyModifiers('-', mods)).toBe('-');
    }
  });
});
