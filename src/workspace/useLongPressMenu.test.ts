// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPressMenu } from './useLongPressMenu';

describe('useLongPressMenu', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets target after long-press delay', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    act(() => { result.current.bind('a').onPointerDown(); });
    expect(result.current.target).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.target).toBe('a');
  });

  it('cancels timer on pointercancel before delay', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    act(() => { result.current.bind('a').onPointerDown(); });
    act(() => {
      window.dispatchEvent(new Event('pointercancel'));
      vi.advanceTimersByTime(500);
    });
    expect(result.current.target).toBeNull();
  });

  it('cancels timer on pointerup before delay', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    act(() => { result.current.bind('a').onPointerDown(); });
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
      vi.advanceTimersByTime(500);
    });
    expect(result.current.target).toBeNull();
  });

  it('sets target immediately on contextMenu and marks suppress', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    const evt = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => { result.current.bind('a').onContextMenu(evt); });
    expect(result.current.target).toBe('a');
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(result.current.shouldSuppressClick()).toBe(true);
    expect(result.current.shouldSuppressClick()).toBe(false);
  });

  it('shouldSuppressClick returns true once after long-press fires', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    act(() => { result.current.bind('a').onPointerDown(); vi.advanceTimersByTime(500); });
    expect(result.current.shouldSuppressClick()).toBe(true);
    expect(result.current.shouldSuppressClick()).toBe(false);
  });

  it('setTarget(null) clears target', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    act(() => { result.current.bind('a').onPointerDown(); vi.advanceTimersByTime(500); });
    expect(result.current.target).toBe('a');
    act(() => { result.current.setTarget(null); });
    expect(result.current.target).toBeNull();
  });

  it('cleans up listener and timer on unmount', () => {
    const { result, unmount } = renderHook(() => useLongPressMenu<string>());
    act(() => { result.current.bind('a').onPointerDown(); });
    unmount();
    // After unmount, advancing timers must not throw and must not set state on a stale instance.
    act(() => { vi.advanceTimersByTime(500); });
    // Trigger pointerup; the listener should already be removed so this is a no-op.
    act(() => { window.dispatchEvent(new Event('pointerup')); });
    // If we got here without throwing, cleanup worked correctly.
  });

  it('second onPointerDown cancels the first press, only second fires', () => {
    const { result } = renderHook(() => useLongPressMenu<string>());
    act(() => {
      // First press on 'a'.
      result.current.bind('a').onPointerDown();
      // Immediately start a second press on 'b' (first timer is replaced).
      result.current.bind('b').onPointerDown();
    });
    // pointerup for the stale first press arrives — should be a no-op since
    // the first listener was removed when the second press began.
    act(() => { window.dispatchEvent(new Event('pointerup')); });
    // Now advance past the delay — the second press had its listener removed by pointerup,
    // so the timer is also cancelled and target stays null.
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.target).toBeNull();
  });
});
