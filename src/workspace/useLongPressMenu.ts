import { useRef, useState, useCallback, useEffect } from 'react';
import { LONG_PRESS_DELAY_MS } from '../lib/constants';

export interface LongPressBind {
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: () => void;
}

export function useLongPressMenu<T>() {
  const [target, setTarget] = useState<T | null>(null);
  const firedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upListenerRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount: clear any pending timer and remove the pointerup listener.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (upListenerRef.current !== null) {
        window.removeEventListener('pointerup', upListenerRef.current);
        window.removeEventListener('pointercancel', upListenerRef.current);
        upListenerRef.current = null;
      }
    };
  }, []);

  const bind = useCallback((item: T): LongPressBind => ({
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      firedRef.current = true;
      setTarget(item);
    },
    onPointerDown: () => {
      // Clear any previous pending press before setting up a new one.
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (upListenerRef.current !== null) {
        window.removeEventListener('pointerup', upListenerRef.current);
        window.removeEventListener('pointercancel', upListenerRef.current);
        upListenerRef.current = null;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        setTarget(item);
      }, LONG_PRESS_DELAY_MS);

      const up = () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        upListenerRef.current = null;
      };
      upListenerRef.current = up;
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
  }), []);

  const shouldSuppressClick = useCallback(() => {
    if (firedRef.current) { firedRef.current = false; return true; }
    return false;
  }, []);

  return { target, setTarget, bind, shouldSuppressClick };
}
