// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ExtraKeyBar } from './ExtraKeyBar';

afterEach(cleanup);

/** The bar's buttons fire on touch, not click — mirror what a finger does. */
function tap(label: string) {
  const button = screen.getByText(label);
  fireEvent.touchStart(button, { touches: [{ clientX: 0, clientY: 0 }] });
  fireEvent.touchEnd(button, { touches: [] });
}

function renderBar() {
  const onKeyPress = vi.fn();
  render(<ExtraKeyBar context="terminal" onKeyPress={onKeyPress} />);
  return onKeyPress;
}

describe('ExtraKeyBar terminal modifiers', () => {
  it('replaces the dedicated S-Tab button with a Shift toggle', () => {
    renderBar();
    expect(screen.queryByText('S-Tab')).toBeNull();
    expect(screen.getByText('Shift')).toBeTruthy();
  });

  it('sends plain tab when nothing is armed', () => {
    const onKeyPress = renderBar();
    tap('Tab');
    expect(onKeyPress).toHaveBeenCalledWith('\t');
  });

  it('sends back-tab after Shift, then falls back to plain tab', () => {
    const onKeyPress = renderBar();
    tap('Shift');
    tap('Tab');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b[Z');

    tap('Tab');
    expect(onKeyPress).toHaveBeenLastCalledWith('\t');
  });

  it('sends ESC CR for Shift + Enter', () => {
    const onKeyPress = renderBar();
    tap('Shift');
    tap('⏎');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b\r');
  });

  it('applies armed Ctrl to bar keys — arrows become word jumps', () => {
    const onKeyPress = renderBar();
    tap('Ctrl');
    tap('←');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b[1;5D');

    tap('→');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b[C');
  });

  it('combines both modifiers', () => {
    const onKeyPress = renderBar();
    tap('Shift');
    tap('Ctrl');
    tap('↑');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b[1;6A');
  });

  it('toggles off when the modifier is tapped twice', () => {
    const onKeyPress = renderBar();
    tap('Shift');
    tap('Shift');
    tap('Tab');
    expect(onKeyPress).toHaveBeenLastCalledWith('\t');
  });

  it('consumes the modifier even on a key with no modified sequence', () => {
    const onKeyPress = renderBar();
    tap('Shift');
    tap('Esc');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b');

    tap('Tab');
    expect(onKeyPress).toHaveBeenLastCalledWith('\t');
  });

  it('keeps the modifier armed across the snippet picker', () => {
    const onKeyPress = renderBar();
    tap('Shift');
    tap('Snip');
    expect(onKeyPress).toHaveBeenLastCalledWith('snippets');

    tap('Tab');
    expect(onKeyPress).toHaveBeenLastCalledWith('\x1b[Z');
  });

  it('leaves the dedicated Ctrl combo buttons in place', () => {
    renderBar();
    for (const label of ['C-c', 'C-o', 'C-d', 'C-z', 'C-a', 'C-l', 'C-b']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});

describe('ExtraKeyBar key repeat', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Holding a D-pad key sends once, then repeats after a delay until the finger lifts. */
  function hold(label: string) {
    const button = screen.getByText(label);
    fireEvent.touchStart(button, { touches: [{ clientX: 0, clientY: 0 }] });
    return button;
  }

  it('repeats while held and stops on touchend', () => {
    vi.useFakeTimers();
    const onKeyPress = renderBar();
    const button = hold('↑');
    vi.advanceTimersByTime(1000);
    const held = onKeyPress.mock.calls.length;
    expect(held).toBeGreaterThan(1);

    fireEvent.touchEnd(button, { touches: [] });
    vi.advanceTimersByTime(5000);
    expect(onKeyPress).toHaveBeenCalledTimes(held);
  });

  // The system takes the touch over (edge back gesture, notification shade, a scroll) and sends
  // touchcancel instead of touchend. Without handling it the key repeated every 80ms for as long
  // as the app lived — straight down the SSH connection, in the background too.
  it('stops repeating when the touch is cancelled', () => {
    vi.useFakeTimers();
    const onKeyPress = renderBar();
    const button = hold('⏎');
    vi.advanceTimersByTime(1000);

    fireEvent.touchCancel(button, { touches: [] });
    const atCancel = onKeyPress.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(onKeyPress).toHaveBeenCalledTimes(atCancel);
  });

  it('stops repeating when the bar unmounts under a held key', () => {
    vi.useFakeTimers();
    const onKeyPress = vi.fn();
    const { unmount } = render(<ExtraKeyBar context="terminal" onKeyPress={onKeyPress} />);
    hold('↓');
    vi.advanceTimersByTime(1000);

    unmount();
    const atUnmount = onKeyPress.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(onKeyPress).toHaveBeenCalledTimes(atUnmount);
  });

  it('never starts repeating when cancelled before the repeat delay', () => {
    vi.useFakeTimers();
    const onKeyPress = renderBar();
    const button = hold('←');
    fireEvent.touchCancel(button, { touches: [] });
    vi.advanceTimersByTime(5000);
    expect(onKeyPress).toHaveBeenCalledTimes(1);
  });
});
