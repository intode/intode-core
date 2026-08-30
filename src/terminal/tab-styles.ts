import type React from 'react';

export interface TabVisualState {
  active: boolean;
  dragging: boolean;
  /** Pixels the dragged tab trails its slot by; ignored unless `dragging`. */
  dragOffset: number;
}

/**
 * Style for one terminal tab, in every state it can be in.
 *
 * Two rules keep this honest, both learned the hard way:
 *
 * 1. Every variant declares the same properties. React clears a property that
 *    disappears between renders, and on a <button> a cleared `background-color`
 *    or `border-bottom-color` falls back to the user agent's button palette —
 *    a grey chip left behind after a drag, a grey underline left behind after
 *    the tab stops being active.
 * 2. No shorthand sits next to one of its own longhands. Assigning
 *    `background: none` and then `backgroundColor` expands the shorthand, so
 *    clearing the longhand later leaves background-color unset entirely.
 */
export function tabVisualStyle({ active, dragging, dragOffset }: TabVisualState): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    height: 32,
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    position: 'relative',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    // A long press is the reorder gesture, so the WebView must not answer it
    // with text selection handles.
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    transition: 'color 150ms ease',

    borderStyle: 'none none solid',
    borderWidth: '0 0 2px',
    borderBottomColor: active ? 'var(--accent-blue)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',

    backgroundColor: dragging ? 'var(--bg-surface0)' : 'transparent',
    borderRadius: dragging ? 6 : 0,
    boxShadow: dragging ? '0 2px 10px rgba(0, 0, 0, 0.35)' : 'none',
    opacity: dragging ? 0.95 : 1,
    zIndex: dragging ? 2 : 'auto',
    transform: dragging ? `translateX(${dragOffset}px)` : 'none',
  };
}
