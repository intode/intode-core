import { describe, it, expect } from 'vitest';
import { tabVisualStyle, tabStripStyle } from './tab-styles';

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

  it('sizes a tab to the strip instead of a fixed height', () => {
    // The strip is a 32px border-box with a 1px bottom border, so a tab fixed
    // at 32px overhangs its content box and the underline gets clipped.
    expect(tabVisualStyle(plain).height).toBe('100%');
  });

  it('offsets only the tab being dragged', () => {
    expect(tabVisualStyle({ ...plain, dragging: true, dragOffset: 12 }).transform).toBe('translateX(12px)');
    expect(tabVisualStyle({ ...plain, dragOffset: 12 }).transform).toBe('none');
  });
});

describe('tabStripStyle', () => {
  it('suppresses the vertical scrollbar', () => {
    // `overflow-x: auto` drags overflow-y from visible to auto, and the pixel
    // the tabs overhang by is enough to raise a vertical scrollbar.
    expect(tabStripStyle.overflowY).toBe('hidden');
  });

  it('takes no layout space for the horizontal scrollbar', () => {
    // It renders along the bottom edge — exactly where the active tab's
    // underline is — and on this WebView it costs 4px of client height,
    // clipping the underline away entirely once the tabs overflow.
    expect(tabStripStyle.scrollbarWidth).toBe('none');
  });

  it('still scrolls horizontally', () => {
    expect(tabStripStyle.overflowX).toBe('auto');
  });
});
