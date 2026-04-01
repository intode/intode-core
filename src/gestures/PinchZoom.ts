import { PINCH_ZOOM_MIN, PINCH_ZOOM_MAX } from '../lib/constants';

export interface PinchZoomConfig {
  element: HTMLElement;
  initialFontSize: number;
  minFontSize?: number;
  maxFontSize?: number;
  onFontSizeChange: (newSize: number) => void;
  onZoomEnd?: (finalSize: number) => void;
}

export class PinchZoom {
  private fontSize: number;
  private minSize: number;
  private maxSize: number;
  private startDistance = 0;
  private startFontSize = 0;
  private isPinching = false;

  private handleTouchStart: (e: TouchEvent) => void;
  private handleTouchMove: (e: TouchEvent) => void;
  private handleTouchEnd: (e: TouchEvent) => void;

  constructor(private config: PinchZoomConfig) {
    this.fontSize = config.initialFontSize;
    this.minSize = config.minFontSize ?? PINCH_ZOOM_MIN;
    this.maxSize = config.maxFontSize ?? PINCH_ZOOM_MAX;

    this.handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      this.isPinching = true;
      this.startDistance = this.getDistance(e.touches[0], e.touches[1]);
      this.startFontSize = this.fontSize;
    };

    this.handleTouchMove = (e: TouchEvent) => {
      if (!this.isPinching || e.touches.length !== 2) return;
      e.preventDefault();

      const distance = this.getDistance(e.touches[0], e.touches[1]);
      const scale = distance / this.startDistance;
      const newSize = Math.round(
        Math.min(this.maxSize, Math.max(this.minSize, this.startFontSize * scale))
      );

      if (newSize !== this.fontSize) {
        this.fontSize = newSize;
        this.config.onFontSizeChange(newSize);
      }
    };

    this.handleTouchEnd = (e: TouchEvent) => {
      if (!this.isPinching) return;
      if (e.touches.length < 2) {
        this.isPinching = false;
        this.config.onZoomEnd?.(this.fontSize);
      }
    };
  }

  attach(): void {
    const el = this.config.element;
    el.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    el.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    el.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  detach(): void {
    const el = this.config.element;
    el.removeEventListener('touchstart', this.handleTouchStart);
    el.removeEventListener('touchmove', this.handleTouchMove);
    el.removeEventListener('touchend', this.handleTouchEnd);
  }

  get currentFontSize(): number {
    return this.fontSize;
  }

  private getDistance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
