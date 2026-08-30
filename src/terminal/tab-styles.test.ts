import { describe, it, expect } from 'vitest';
import { tabVisualStyle } from './tab-styles';

const VARIANTS = [
  { active: false, dragging: false, dragOffset: 0 },
  { active: true, dragging: false, dragOffset: 0 },
  { active: false, dragging: true, dragOffset: 12 },
  { active: true, dragging: true, dragOffset: 12 },
];

const plain = { active: false, dragging: false, dragOffset: 0 };

describe('tabVisualStyle', () => {
  it('declares the same properties in every variant', () => {
    // React removes a property that disappears between renders by clearing it,
    // which falls back to the UA button colours rather than the intended value.
    const shapes = VARIANTS.map((v) => Object.keys(tabVisualStyle(v)).sort().join(','));
    expect(new Set(shapes).size).toBe(1);
  });

  it('never pairs a shorthand with one of its own longhands', () => {
    // `background: none` alongside `backgroundColor` expands the shorthand, so
    // clearing the longhand leaves background-color unset entirely.
    for (const v of VARIANTS) {
      const keys = Object.keys(tabVisualStyle(v));
      expect(keys).not.toContain('background');
      expect(keys).not.toContain('borderBottom');
      expect(keys).not.toContain('border');
    }
  });

  it('paints an explicit background on a tab that is not being dragged', () => {
    expect(tabVisualStyle(plain).backgroundColor).toBe('transparent');
  });

  it('paints an explicit underline colour on an inactive tab', () => {
    expect(tabVisualStyle(plain).borderBottomColor).toBe('transparent');
  });

  it('accents the underline of the active tab', () => {
    expect(tabVisualStyle({ ...plain, active: true }).borderBottomColor).toBe('var(--accent-blue)');
  });

  it('offsets only the tab being dragged', () => {
    expect(tabVisualStyle({ ...plain, dragging: true, dragOffset: 12 }).transform).toBe('translateX(12px)');
    expect(tabVisualStyle({ ...plain, dragOffset: 12 }).transform).toBe('none');
  });
});
