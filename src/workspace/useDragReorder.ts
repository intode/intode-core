import { useRef, useState, useCallback, useEffect } from 'react';

/** Fallback inter-row gap when the row pitch cannot be measured. */
const CARD_GAP = 8;
/** Distance from the list edge (px) that triggers auto-scroll while dragging. */
const EDGE_ZONE = 48;
/** Max auto-scroll speed in px per animation frame. */
const MAX_SCROLL_STEP = 8;

/** Slot index the dragged card would land on for a given vertical offset. */
export function computeDropIndex(startIndex: number, offsetY: number, itemCount: number, rowHeight: number): number {
  const moved = Math.round(offsetY / rowHeight);
  return Math.min(Math.max(startIndex + moved, 0), itemCount - 1);
}

/** translateY for a non-dragged card while a drag is in progress. */
export function computeShift(index: number, startIndex: number, targetIndex: number, rowHeight: number): number {
  if (startIndex < targetIndex && index > startIndex && index <= targetIndex) return -rowHeight;
  if (startIndex > targetIndex && index >= targetIndex && index < startIndex) return rowHeight;
  return 0;
}

interface DragState {
  start: number;
  target: number;
  offset: number;
}

/**
 * Vertical drag-to-reorder for a uniform-height card list. The list order is
 * NOT changed during the drag — cards shift visually via transforms, and
 * onDrop(from, to) fires once on release for the caller to commit the move.
 * Spread handleProps(i) on the drag handle (a child of row i, or the row
 * itself); the row height is measured from listRef's i-th child, so rows
 * stay free for normal scroll gestures.
 */
export function useDragReorder({ enabled, itemCount, listRef, onDrop }: {
  enabled: boolean;
  itemCount: number;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDrop: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rowHeightRef = useRef(1);
  const startClientYRef = useRef(0);
  const lastClientYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setDragBoth = (d: DragState | null) => { dragRef.current = d; setDrag(d); };

  // Abort an in-flight drag if the component unmounts.
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const updateTarget = useCallback(() => {
    const d = dragRef.current;
    const list = listRef.current;
    if (!d || !list) return;
    const scrollDelta = list.scrollTop - startScrollTopRef.current;
    const offset = (lastClientYRef.current - startClientYRef.current) + scrollDelta;
    const target = computeDropIndex(d.start, offset, itemCount, rowHeightRef.current);
    setDragBoth({ start: d.start, target, offset });
  }, [itemCount, listRef]);

  const autoScrollTick = useCallback(() => {
    const list = listRef.current;
    if (!list || dragRef.current === null) { scrollRafRef.current = null; return; }
    const rect = list.getBoundingClientRect();
    const y = lastClientYRef.current;
    let step = 0;
    if (y < rect.top + EDGE_ZONE) step = -Math.min(MAX_SCROLL_STEP, (rect.top + EDGE_ZONE - y) / 4);
    else if (y > rect.bottom - EDGE_ZONE) step = Math.min(MAX_SCROLL_STEP, (y - (rect.bottom - EDGE_ZONE)) / 4);
    if (step !== 0) {
      list.scrollTop += step;
      updateTarget();
    }
    scrollRafRef.current = requestAnimationFrame(autoScrollTick);
  }, [listRef, updateTarget]);

  const handleProps = useCallback((index: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || dragRef.current !== null) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      // The handle may be a small child of the row — measure the row pitch
      // from adjacent children's offsetTop (ignores transforms and works for
      // any inter-row gap). Falls back to row height + CARD_GAP.
      const listEl = listRef.current;
      const row = listEl?.children[index] as HTMLElement | undefined;
      const next = listEl?.children[index + 1] as HTMLElement | undefined;
      const prev = listEl?.children[index - 1] as HTMLElement | undefined;
      rowHeightRef.current =
        row && next ? next.offsetTop - row.offsetTop :
        row && prev ? row.offsetTop - prev.offsetTop :
        (row?.offsetHeight ?? el.offsetHeight) + CARD_GAP;
      startClientYRef.current = e.clientY;
      lastClientYRef.current = e.clientY;
      startScrollTopRef.current = listRef.current?.scrollTop ?? 0;
      setDragBoth({ start: index, target: index, offset: 0 });

      const move = (ev: PointerEvent) => {
        lastClientYRef.current = ev.clientY;
        updateTarget();
      };
      const finish = (commit: boolean) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        if (scrollRafRef.current !== null) { cancelAnimationFrame(scrollRafRef.current); scrollRafRef.current = null; }
        cleanupRef.current = null;
        const d = dragRef.current;
        setDragBoth(null);
        if (commit && d && d.start !== d.target) onDrop(d.start, d.target);
      };
      const up = () => finish(true);
      const cancel = () => finish(false);
      cleanupRef.current = () => finish(false);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      scrollRafRef.current = requestAnimationFrame(autoScrollTick);
    },
  }), [enabled, listRef, updateTarget, autoScrollTick, onDrop]);

  const itemStyle = useCallback((index: number): React.CSSProperties => {
    if (!drag) return {};
    if (index === drag.start) {
      return {
        transform: `translateY(${drag.offset}px)`,
        zIndex: 10,
        position: 'relative',
        transition: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      };
    }
    return {
      transform: `translateY(${computeShift(index, drag.start, drag.target, rowHeightRef.current)}px)`,
      transition: 'transform 150ms ease',
    };
  }, [drag]);

  return { dragging: drag !== null, handleProps, itemStyle };
}
