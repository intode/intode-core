/**
 * Pinch zoom levels survive app restarts — the size you pinched to is the size
 * you come back to. Stored per surface: a comfortable terminal size is not a
 * comfortable size for prose.
 */
import {
  PINCH_ZOOM_MIN,
  PINCH_ZOOM_MAX,
  TERMINAL_DEFAULT_FONT_SIZE,
  EDITOR_FONT_SIZE,
  MD_PREVIEW_FONT_SIZE,
} from '../lib/constants';

export type ZoomSurface = 'terminal' | 'editor' | 'md-preview';

const DEFAULTS: Record<ZoomSurface, number> = {
  terminal: TERMINAL_DEFAULT_FONT_SIZE,
  editor: EDITOR_FONT_SIZE,
  'md-preview': MD_PREVIEW_FONT_SIZE,
};

const STORAGE_PREFIX = 'intode_zoom_';

/** Saved font size for a surface, or its default when nothing valid is stored. */
export function loadZoom(surface: ZoomSurface): number {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + surface);
    if (raw === null) return DEFAULTS[surface];
    const size = Math.round(Number(raw));
    if (!Number.isFinite(size)) return DEFAULTS[surface];
    return Math.min(PINCH_ZOOM_MAX, Math.max(PINCH_ZOOM_MIN, size));
  } catch {
    return DEFAULTS[surface];
  }
}

export function saveZoom(surface: ZoomSurface, size: number): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + surface, String(Math.round(size)));
  } catch {
    /* storage unavailable — zoom just won't survive the restart */
  }
}
