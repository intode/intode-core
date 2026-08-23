// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadZoom, saveZoom } from './zoom-store';
import {
  PINCH_ZOOM_MIN,
  PINCH_ZOOM_MAX,
  TERMINAL_DEFAULT_FONT_SIZE,
  MD_PREVIEW_FONT_SIZE,
} from '../lib/constants';

describe('zoom-store', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to the surface default when nothing is stored', () => {
    expect(loadZoom('terminal')).toBe(TERMINAL_DEFAULT_FONT_SIZE);
    expect(loadZoom('md-preview')).toBe(MD_PREVIEW_FONT_SIZE);
  });

  it('round-trips a saved size', () => {
    saveZoom('terminal', 18);
    expect(loadZoom('terminal')).toBe(18);
  });

  it('keeps surfaces independent', () => {
    saveZoom('terminal', 18);
    expect(loadZoom('editor')).not.toBe(18);
  });

  it('clamps a stored size that is out of pinch range', () => {
    saveZoom('editor', 999);
    expect(loadZoom('editor')).toBe(PINCH_ZOOM_MAX);
    saveZoom('editor', 1);
    expect(loadZoom('editor')).toBe(PINCH_ZOOM_MIN);
  });

  it('ignores a corrupted value', () => {
    localStorage.setItem('intode_zoom_terminal', 'not-a-number');
    expect(loadZoom('terminal')).toBe(TERMINAL_DEFAULT_FONT_SIZE);
  });
});
