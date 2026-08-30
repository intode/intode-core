// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LONG_PRESS_DELAY_MS } from '../lib/constants';
import { resolveDropIndex, moveItem, shiftBetween, clampDragDx, useTabDragReorder } from './useTabDragReorder';

// Three tabs, 100px each, dragging the middle one.
const EQUAL = [100, 100, 100];

describe('resolveDropIndex', () => {
  it('keeps the original index when the pointer has not moved', () => {
    expect(resolveDropIndex(EQUAL, 1, 0)).toBe(1);
  });

  it('keeps the original index until the neighbour midpoint is crossed', () => {
    expect(resolveDropIndex(EQUAL, 1, 49)).toBe(1);
  });

  it('moves one slot right once the right neighbour midpoint is crossed', () => {
    expect(resolveDropIndex(EQUAL, 1, 50)).toBe(2);
  });

  it('moves one slot left once the left neighbour midpoint is crossed', () => {
    expect(resolveDropIndex(EQUAL, 1, -50)).toBe(0);
  });

  it('moves two slots right when the first neighbour plus half the second is passed', () => {
    expect(resolveDropIndex([100, 100, 100, 100], 0, 150)).toBe(2);
  });

  it('uses each tab own width, not a uniform one', () => {
    // Dragging tab 0 past a wide tmux tab (240px) needs 120px, not 50px.
    expect(resolveDropIndex([100, 240, 100], 0, 119)).toBe(0);
    expect(resolveDropIndex([100, 240, 100], 0, 120)).toBe(1);
  });

  it('clamps to the last index when dragged far past the end', () => {
    expect(resolveDropIndex(EQUAL, 0, 9999)).toBe(2);
  });

  it('clamps to the first index when dragged far past the start', () => {
    expect(resolveDropIndex(EQUAL, 2, -9999)).toBe(0);
  });
});

describe('clampDragDx', () => {
  it('leaves a delta that lands inside the strip alone', () => {
    expect(clampDragDx(EQUAL, 1, 60)).toBe(60);
  });

  it('caps a rightward drag at the width of the tabs that follow', () => {
    expect(clampDragDx(EQUAL, 1, 9999)).toBe(100);
  });

  it('caps a leftward drag at the width of the tabs that precede', () => {
    expect(clampDragDx(EQUAL, 1, -9999)).toBe(-100);
  });

  it('caps against each tab own width', () => {
    expect(clampDragDx([100, 240, 100], 0, 9999)).toBe(340);
  });

  it('leaves the last tab no room to travel right', () => {
    expect(clampDragDx(EQUAL, 2, 9999)).toBe(0);
  });
});

describe('moveItem', () => {
  it('moves an item forward, shifting the passed items back', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward, shifting the passed items forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns an equal list when the index is unchanged', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('shiftBetween', () => {
  it('is zero when the tab did not change slot', () => {
    expect(shiftBetween(EQUAL, 1, 1)).toBe(0);
  });

  it('is the total width of the tabs passed on the way right', () => {
    expect(shiftBetween([100, 240, 100], 0, 1)).toBe(240);
  });

  it('is negative for the tabs passed on the way left', () => {
    expect(shiftBetween(EQUAL, 2, 0)).toBe(-200);
  });
});

describe('useTabDragReorder', () => {
  const IDS = ['a', 'b', 'c'];

  function setup(ids: string[] = IDS, widths: number[] = EQUAL) {
    const onReorder = vi.fn();
    const onLongPressTap = vi.fn();
    const measureWidths = vi.fn(() => widths);
    const barRef = { current: null } as React.RefObject<HTMLElement | null>;
    const view = renderHook(() =>
      useTabDragReorder({
        ids,
        measureWidths,
        onReorder,
        onLongPressTap,
        barRef,
      }),
    );
    return { ...view, onReorder, onLongPressTap, measureWidths };
  }

  function down(
    result: { current: ReturnType<typeof useTabDragReorder> },
    id: string,
    clientX = 0,
    pointerType: 'touch' | 'mouse' = 'touch',
    button = 0,
  ) {
    act(() => {
      result.current.bind(id).onPointerDown({
        clientX, pointerType, button,
      } as unknown as React.PointerEvent);
    });
  }

  function pointer(type: 'pointermove' | 'pointerup' | 'pointercancel', clientX = 0) {
    act(() => { window.dispatchEvent(new MouseEvent(type, { clientX })); });
  }

  function hold() { act(() => { vi.advanceTimersByTime(LONG_PRESS_DELAY_MS); }); }

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not start dragging before the long-press delay elapses', () => {
    const { result } = setup();
    down(result, 'b');
    act(() => { vi.advanceTimersByTime(LONG_PRESS_DELAY_MS - 1); });
    expect(result.current.draggingId).toBeNull();
  });

  it('starts dragging the pressed tab once the delay elapses', () => {
    const { result } = setup();
    down(result, 'b');
    hold();
    expect(result.current.draggingId).toBe('b');
  });

  it('cancels the pending press when the pointer moves past the tolerance', () => {
    const { result } = setup();
    down(result, 'b', 0);
    pointer('pointermove', 20);
    hold();
    expect(result.current.draggingId).toBeNull();
  });

  it('tolerates small jitter while waiting for the delay', () => {
    const { result } = setup();
    down(result, 'b', 0);
    pointer('pointermove', 5);
    hold();
    expect(result.current.draggingId).toBe('b');
  });

  it('reorders once the drag passes the next tab midpoint', () => {
    const { result, onReorder } = setup();
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 50);
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('keeps the dragged tab under the finger by reporting the residual offset', () => {
    // Four tabs, so 120px of travel still has room left in the strip.
    const { result } = setup(['a', 'b', 'c', 'd'], [100, 100, 100, 100]);
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 120);
    // Slot moved 100px right, so only the remaining 20px is a visual offset.
    expect(result.current.dragOffset).toBe(20);
  });

  it('does not reorder again while the pointer stays in the same slot', () => {
    const { result, onReorder } = setup();
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 50);
    pointer('pointermove', 60);
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it('always reorders from the layout captured at drag start', () => {
    const { result, onReorder } = setup();
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 50);
    pointer('pointermove', -50);
    expect(onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c']);
  });

  it('stops offsetting the tab once it reaches the last slot', () => {
    const { result } = setup();
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 5000);
    // Past the end there is nowhere left to go, so the tab sits in its slot.
    // An offset here would widen the strip's scrollable area and let the edge
    // auto-scroll run forever.
    expect(result.current.dragOffset).toBe(0);
  });

  it('runs the context action when the press is released without moving', () => {
    const { result, onLongPressTap } = setup();
    down(result, 'b');
    hold();
    pointer('pointerup');
    expect(onLongPressTap).toHaveBeenCalledWith('b');
  });

  it('does not run the context action after the tab was actually dragged', () => {
    const { result, onLongPressTap } = setup();
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 50);
    pointer('pointerup', 50);
    expect(onLongPressTap).not.toHaveBeenCalled();
  });

  it('ends the drag on pointerup', () => {
    const { result } = setup();
    down(result, 'b');
    hold();
    pointer('pointerup');
    expect(result.current.draggingId).toBeNull();
  });

  it('ends the drag on pointercancel', () => {
    const { result } = setup();
    down(result, 'b');
    hold();
    pointer('pointercancel');
    expect(result.current.draggingId).toBeNull();
  });

  it('suppresses the click that follows a drag, only once', () => {
    const { result } = setup();
    down(result, 'b', 0);
    hold();
    pointer('pointermove', 50);
    pointer('pointerup', 50);
    expect(result.current.shouldSuppressClick()).toBe(true);
    expect(result.current.shouldSuppressClick()).toBe(false);
  });

  it('does not suppress a plain tap', () => {
    const { result } = setup();
    down(result, 'b');
    pointer('pointerup');
    expect(result.current.shouldSuppressClick()).toBe(false);
  });

  it('runs the context action immediately on a right-click', () => {
    const { result, onLongPressTap } = setup();
    down(result, 'b', 0, 'mouse', 2);
    const evt = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => { result.current.bind('b').onContextMenu(evt); });
    expect(onLongPressTap).toHaveBeenCalledWith('b');
  });

  it('leaves the touch context menu to the drag gesture', () => {
    const { result, onLongPressTap } = setup();
    down(result, 'b');
    const evt = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => { result.current.bind('b').onContextMenu(evt); });
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(onLongPressTap).not.toHaveBeenCalled();
  });

  it('drops the pending press when the component unmounts', () => {
    const { result, unmount, measureWidths } = setup();
    down(result, 'b');
    unmount();
    act(() => { vi.advanceTimersByTime(LONG_PRESS_DELAY_MS); });
    expect(measureWidths).not.toHaveBeenCalled();
  });
});
