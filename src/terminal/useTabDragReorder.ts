import { useCallback, useEffect, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LONG_PRESS_DELAY_MS } from '../lib/constants';

/** Travel that turns a press into a scroll instead of a drag. */
const DRAG_TOLERANCE_PX = 8;
/** Distance from a bar edge that keeps the strip auto-scrolling. */
const EDGE_ZONE_PX = 24;
/** Auto-scroll speed while the pointer sits in the edge zone. */
const EDGE_SPEED_PX = 6;

/**
 * Index the dragged tab should occupy after the pointer moved `dx` pixels.
 *
 * Thresholds are measured against the layout captured at drag start, so the
 * result depends only on the total delta — a drag that wanders back and forth
 * lands where the finger actually is, with no accumulated drift. A tab is
 * passed once the drag covers everything before it plus half of the tab
 * itself, so a wide tab (a long tmux session name) takes proportionally more
 * travel than a narrow one.
 */
export function resolveDropIndex(widths: number[], fromIndex: number, dx: number): number {
  let target = fromIndex;
  let acc = 0;
  if (dx > 0) {
    for (let j = fromIndex + 1; j < widths.length; j++) {
      acc += widths[j];
      if (dx < acc - widths[j] / 2) break;
      target = j;
    }
  } else if (dx < 0) {
    for (let j = fromIndex - 1; j >= 0; j--) {
      acc += widths[j];
      if (-dx < acc - widths[j] / 2) break;
      target = j;
    }
  }
  return target;
}

/** How far a tab's slot moves when it travels from index `from` to `to`. */
export function shiftBetween(widths: number[], from: number, to: number): number {
  let shift = 0;
  for (let j = from + 1; j <= to; j++) shift += widths[j];
  for (let j = to; j <= from - 1; j++) shift -= widths[j];
  return shift;
}

/**
 * Delta trimmed to the travel the strip actually has room for.
 *
 * Without this the offset keeps growing past the last slot, and since a
 * transform counts toward a scroll container's scrollable overflow, the strip
 * grows with it — which gives the edge auto-scroll new room on every frame and
 * it never stops.
 */
export function clampDragDx(widths: number[], fromIndex: number, dx: number): number {
  let room = 0;
  if (dx > 0) {
    for (let j = fromIndex + 1; j < widths.length; j++) room += widths[j];
    return Math.min(dx, room);
  }
  if (dx < 0) {
    for (let j = 0; j < fromIndex; j++) room += widths[j];
    return Math.max(dx, -room);
  }
  return dx;
}

/** Copy of `items` with the entry at `from` relocated to `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function buzz(style: ImpactStyle) {
  try {
    Haptics.impact({ style }).catch(() => {});
  } catch { /* unavailable outside the app */ }
}

export interface TabDragReorderOptions {
  /** Tab ids in render order. */
  ids: string[];
  /** Rendered width of every tab, in render order. Read once per drag. */
  measureWidths: () => number[];
  /** Commit a reordered id list. Fired live, while the finger is still down. */
  onReorder: (ids: string[]) => void;
  /** Long press released without dragging — the tab's context action. */
  onLongPressTap: (id: string) => void;
  /** The horizontally scrolling strip the tabs live in. */
  barRef: React.RefObject<HTMLElement | null>;
}

interface Drag {
  id: string;
  /** Index and layout as they were when the drag started. */
  fromIndex: number;
  ids: string[];
  widths: number[];
  /** Pointer position at drag start, in the strip's content coordinates. */
  originX: number;
  currentIndex: number;
  lastClientX: number;
  moved: boolean;
}

/**
 * Long-press a tab to pick it up, then slide it to a new position.
 *
 * The order is committed live on every slot change rather than on drop, so the
 * strip the user sees is always the real order — and on release there is
 * nothing left to animate back into place.
 */
export function useTabDragReorder(options: TabDragReorderOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Handlers live on window for the length of a gesture, so they read options
  // through a ref rather than closing over a single render's values.
  const optsRef = useRef(options);
  optsRef.current = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ id: string; startX: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<string>('');
  const suppressClickRef = useRef(false);

  // removeEventListener only matches the exact function that was added, so the
  // registered listeners are created once and forward to the current logic,
  // which is refreshed below on every render.
  const logicRef = useRef({
    move: (_e: MouseEvent) => {},
    up: () => {},
    cancel: () => {},
  });
  const listeners = useRef({
    move: (e: MouseEvent) => logicRef.current.move(e),
    up: () => logicRef.current.up(),
    cancel: () => logicRef.current.cancel(),
  }).current;

  const scrollLeft = () => optsRef.current.barRef.current?.scrollLeft ?? 0;

  const detach = useCallback(() => {
    window.removeEventListener('pointermove', listeners.move);
    window.removeEventListener('pointerup', listeners.up);
    window.removeEventListener('pointercancel', listeners.cancel);
  }, [listeners]);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current === null) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  /** Abandon a press that never became a drag. */
  const release = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    detach();
  }, [detach]);

  const applyMove = useCallback((clientX: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.lastClientX = clientX;
    const travelled = clientX + scrollLeft() - drag.originX;
    // `moved` asks whether the finger moved, so it reads the raw travel — a
    // drag that runs past the end is still a drag, not a long-press tap.
    if (Math.abs(travelled) > DRAG_TOLERANCE_PX) drag.moved = true;
    const dx = clampDragDx(drag.widths, drag.fromIndex, travelled);
    const target = resolveDropIndex(drag.widths, drag.fromIndex, dx);
    if (target !== drag.currentIndex) {
      drag.currentIndex = target;
      buzz(ImpactStyle.Light);
      optsRef.current.onReorder(moveItem(drag.ids, drag.fromIndex, target));
    }
    setDragOffset(dx - shiftBetween(drag.widths, drag.fromIndex, target));
  }, []);

  const startAutoScroll = useCallback(() => {
    const step = () => {
      const drag = dragRef.current;
      const bar = optsRef.current.barRef.current;
      if (!drag || !bar) {
        rafRef.current = null;
        return;
      }
      const rect = bar.getBoundingClientRect();
      const delta = drag.lastClientX < rect.left + EDGE_ZONE_PX ? -EDGE_SPEED_PX
                  : drag.lastClientX > rect.right - EDGE_ZONE_PX ? EDGE_SPEED_PX
                  : 0;
      if (delta !== 0) {
        const before = bar.scrollLeft;
        bar.scrollLeft = before + delta;
        // Scrolling slides the tabs under a stationary finger, so the drop
        // target has to be recomputed even though the pointer did not move.
        if (bar.scrollLeft !== before) applyMove(drag.lastClientX);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyMove]);

  const endDrag = useCallback((runContextAction: boolean) => {
    detach();
    stopAutoScroll();
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    setDragOffset(0);
    if (!drag) return;
    if (drag.moved) suppressClickRef.current = true;
    else if (runContextAction) optsRef.current.onLongPressTap(drag.id);
  }, [detach, stopAutoScroll]);

  logicRef.current = {
    move: (e: MouseEvent) => {
      if (dragRef.current) {
        applyMove(e.clientX);
        return;
      }
      const pending = pendingRef.current;
      // Moving before the tab is picked up means the user wanted to scroll.
      if (pending && Math.abs(e.clientX - pending.startX) > DRAG_TOLERANCE_PX) release();
    },
    up: () => {
      if (dragRef.current) endDrag(true);
      else release();
    },
    cancel: () => {
      if (dragRef.current) endDrag(false);
      else release();
    },
  };

  const startDrag = useCallback((id: string, startX: number) => {
    timerRef.current = null;
    pendingRef.current = null;
    const { ids, measureWidths } = optsRef.current;
    const fromIndex = ids.indexOf(id);
    if (fromIndex < 0) {
      release();
      return;
    }
    dragRef.current = {
      id,
      fromIndex,
      ids: ids.slice(),
      widths: measureWidths(),
      originX: startX + scrollLeft(),
      currentIndex: fromIndex,
      lastClientX: startX,
      moved: false,
    };
    buzz(ImpactStyle.Medium);
    setDraggingId(id);
    setDragOffset(0);
    startAutoScroll();
  }, [release, startAutoScroll]);

  const bind = useCallback((id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      pointerTypeRef.current = e.pointerType;
      if (e.button !== 0) return;
      release();
      pendingRef.current = { id, startX: e.clientX };
      window.addEventListener('pointermove', listeners.move);
      window.addEventListener('pointerup', listeners.up);
      window.addEventListener('pointercancel', listeners.cancel);
      const startX = e.clientX;
      timerRef.current = setTimeout(() => startDrag(id, startX), LONG_PRESS_DELAY_MS);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      // A touch long-press is the drag gesture; only a real right-click is a
      // request for the context action here.
      if (pointerTypeRef.current !== 'mouse') return;
      release();
      optsRef.current.onLongPressTap(id);
    },
  }), [listeners, release, startDrag]);

  // While a tab is held, the strip must not pan under it. React attaches touch
  // listeners passively, so preventDefault needs a listener of our own.
  useEffect(() => {
    const bar = optsRef.current.barRef.current;
    if (!bar || !draggingId) return;
    const block = (e: TouchEvent) => e.preventDefault();
    bar.addEventListener('touchmove', block, { passive: false });
    return () => bar.removeEventListener('touchmove', block);
  }, [draggingId]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    dragRef.current = null;
    stopAutoScroll();
    detach();
  }, [detach, stopAutoScroll]);

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return { draggingId, dragOffset, bind, shouldSuppressClick };
}
