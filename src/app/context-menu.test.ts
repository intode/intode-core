// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { keepsNativeContextMenu } from './context-menu';

function inside(className: string): HTMLElement {
  const host = document.createElement('div');
  host.className = className;
  const child = document.createElement('span');
  host.appendChild(child);
  return child;
}

describe('keepsNativeContextMenu', () => {
  it('keeps it for a text input', () => {
    // The native menu is the only copy/paste affordance a field has.
    expect(keepsNativeContextMenu(document.createElement('input'))).toBe(true);
  });

  it('keeps it for a textarea', () => {
    expect(keepsNativeContextMenu(document.createElement('textarea'))).toBe(true);
  });

  it('keeps it inside the code editor', () => {
    expect(keepsNativeContextMenu(inside('cm-content'))).toBe(true);
  });

  it('drops it for ordinary page chrome', () => {
    expect(keepsNativeContextMenu(document.createElement('div'))).toBe(false);
  });

  it('drops it when there is no element to judge', () => {
    expect(keepsNativeContextMenu(null)).toBe(false);
  });
});
