import type { Terminal } from '@xterm/xterm';
import { LONG_PRESS_DELAY_MS } from '../lib/constants';

const MOVE_THRESHOLD = 10;
const MOMENTUM_FRICTION = 0.96;
const MOMENTUM_MIN = 0.3;

export interface HandlePositions {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface SelectionCallbacks {
  onSelectionStart: () => void;
  onSelectionChange: (hasSelection: boolean) => void;
  /** Called when scrolling in mouse tracking mode (tmux). Parent sends wheel escape sequences. */
  onMouseWheel?: (direction: 'up' | 'down') => void;
}

export class TerminalSelection {
  private longPressTimer: number | null = null;
  private isDragging = false;
  private wasMoved = false;
  private isScrolling = false;
  private startTouch: { x: number; y: number } | null = null;
  private lastTouchY = 0;
  private scrollVelocity = 0;
  private scrollAccum = 0;
  private momentumFrame = 0;
  private anchorCol = 0;
  private anchorRow = 0;
  private selStartCol = 0;
  private selStartRow = 0;
  private selEndCol = 0;
  private selEndRow = 0;
  private containerEl: HTMLElement | null = null;
  private disposables: (() => void)[] = [];

  isHandleDrag = false;

  constructor(
    private terminal: Terminal,
    private callbacks: SelectionCallbacks,
  ) {}

  attach(element: HTMLElement): void {
    this.containerEl = element;

    const onTouchStart = (e: TouchEvent) => this.onTouchStart(e);
    const onTouchMove = (e: TouchEvent) => this.onTouchMove(e);
    const onTouchEnd = () => this.onTouchEnd();

    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: true });

    const d = this.terminal.onSelectionChange(() => {
      this.callbacks.onSelectionChange(this.terminal.hasSelection());
    });

    this.disposables.push(
      () => element.removeEventListener('touchstart', onTouchStart),
      () => element.removeEventListener('touchmove', onTouchMove),
      () => element.removeEventListener('touchend', onTouchEnd),
      () => d.dispose(),
    );
  }

  dispose(): void {
    this.cancelLongPress();
    this.stopMomentum();
    for (const fn of this.disposables) fn();
    this.disposables = [];
    this.containerEl = null;
  }

  // --- Touch handlers ---

  private onTouchStart(e: TouchEvent) {
    if (this.isHandleDrag) return;
    if (e.touches.length !== 1) {
      this.cancelLongPress();
      return;
    }
    e.preventDefault(); // Prevent keyboard show/hide on touch
    this.stopMomentum();
    const t = e.touches[0];
    this.startTouch = { x: t.clientX, y: t.clientY };
    this.lastTouchY = t.clientY;
    this.wasMoved = false;
    this.isDragging = false;
    this.isScrolling = false;
    this.scrollVelocity = 0;
    this.scrollAccum = 0;

    this.longPressTimer = window.setTimeout(() => {
      this.beginSelection(t.clientX, t.clientY);
    }, LONG_PRESS_DELAY_MS);
  }

  private onTouchMove(e: TouchEvent) {
    if (this.isHandleDrag) return;
    if (!this.startTouch || e.touches.length !== 1) return;
    const t = e.touches[0];

    // Selection drag mode (after long press)
    if (this.isDragging) {
      e.preventDefault();
      this.extendTo(t.clientX, t.clientY);
      return;
    }

    const dx = t.clientX - this.startTouch.x;
    const dy = t.clientY - this.startTouch.y;

    // Detect scroll start
    if (!this.isScrolling && !this.wasMoved) {
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
        this.cancelLongPress();
        this.wasMoved = true;
        this.isScrolling = true;
        // Don't update lastTouchY here — use startTouch.y so first delta includes full displacement
      } else {
        return;
      }
    }

    // Scrolling (falls through from detection above for immediate first delta)
    if (this.isScrolling) {
      const deltaY = this.lastTouchY - t.clientY;
      this.lastTouchY = t.clientY;
      this.scrollVelocity = deltaY;
      this.handleScroll(deltaY);
      e.preventDefault();
    }
  }

  private onTouchEnd() {
    if (this.isHandleDrag) return;
    const wasSelecting = this.isDragging;
    const wasScrolling = this.isScrolling;
    this.cancelLongPress();
    this.isDragging = false;
    this.isScrolling = false;

    if (wasScrolling) {
      this.startMomentum();
      return;
    }

    if (!wasSelecting && !this.wasMoved && this.terminal.hasSelection()) {
      this.terminal.clearSelection();
    }
  }

  // --- Scroll ---

  private handleScroll(deltaY: number) {
    if ((this.terminal as any).modes?.mouseTrackingMode !== 'none') {
      // Mouse tracking active (tmux) — convert to wheel events
      const cellH = this.getCellDims()?.cellH ?? 16;
      this.scrollAccum += deltaY;
      while (Math.abs(this.scrollAccum) >= cellH) {
        const dir = this.scrollAccum > 0 ? 'down' : 'up';
        this.callbacks.onMouseWheel?.(dir);
        this.scrollAccum -= this.scrollAccum > 0 ? cellH : -cellH;
      }
    } else {
      // Normal mode — scroll viewport
      const vp = this.terminal.element?.querySelector('.xterm-viewport') as HTMLElement | null;
      if (vp) vp.scrollTop += deltaY;
    }
  }

  private startMomentum() {
    const step = () => {
      if (Math.abs(this.scrollVelocity) < MOMENTUM_MIN) return;
      this.scrollVelocity *= MOMENTUM_FRICTION;
      this.handleScroll(this.scrollVelocity);
      this.momentumFrame = requestAnimationFrame(step);
    };
    this.momentumFrame = requestAnimationFrame(step);
  }

  private stopMomentum() {
    if (this.momentumFrame) {
      cancelAnimationFrame(this.momentumFrame);
      this.momentumFrame = 0;
    }
  }

  // --- Selection logic ---

  private beginSelection(clientX: number, clientY: number) {
    const pos = this.toBufPos(clientX, clientY);
    if (!pos) return;

    navigator.vibrate?.(30);

    const { start, length } = this.wordAt(pos.col, pos.bufRow);
    this.anchorCol = start;
    this.anchorRow = pos.vpRow;
    this.selStartCol = start;
    this.selStartRow = pos.vpRow;
    this.selEndCol = start + length - 1;
    this.selEndRow = pos.vpRow;
    this.terminal.select(start, pos.vpRow, length);

    this.isDragging = true;
    this.callbacks.onSelectionStart();
  }

  private extendTo(clientX: number, clientY: number) {
    const pos = this.toBufPos(clientX, clientY);
    if (!pos) return;

    if (pos.vpRow < this.anchorRow || (pos.vpRow === this.anchorRow && pos.col < this.anchorCol)) {
      this.selStartCol = pos.col;
      this.selStartRow = pos.vpRow;
      this.selEndCol = this.anchorCol;
      this.selEndRow = this.anchorRow;
    } else {
      this.selStartCol = this.anchorCol;
      this.selStartRow = this.anchorRow;
      this.selEndCol = pos.col;
      this.selEndRow = pos.vpRow;
    }

    this.applySelection();
  }

  private applySelection(): void {
    const len = (this.selEndRow - this.selStartRow) * this.terminal.cols + (this.selEndCol - this.selStartCol) + 1;
    this.terminal.select(this.selStartCol, this.selStartRow, Math.max(1, len));
  }

  private wordAt(col: number, bufRow: number): { start: number; length: number } {
    const line = this.terminal.buffer.active.getLine(bufRow);
    if (!line) return { start: col, length: 1 };

    const text = line.translateToString();
    if (!text.trim()) return { start: 0, length: this.terminal.cols };

    const isWord = (c: string) => /[\w\-\.\/\:]/.test(c);
    let s = Math.min(col, text.length - 1);
    let e = s;

    if (!isWord(text[s])) return { start: 0, length: this.terminal.cols };

    while (s > 0 && isWord(text[s - 1])) s--;
    while (e < text.length - 1 && isWord(text[e + 1])) e++;

    return { start: s, length: e - s + 1 };
  }

  // --- Coordinate conversion ---

  private getCellDims(): { cellW: number; cellH: number } | null {
    const core = (this.terminal as any)._core;
    const dims = core?._renderService?.dimensions;
    if (!dims) return null;
    return { cellW: dims.css.cell.width, cellH: dims.css.cell.height };
  }

  private toBufPos(clientX: number, clientY: number): { col: number; vpRow: number; bufRow: number } | null {
    const el = this.terminal.element;
    if (!el) return null;
    const dims = this.getCellDims();
    if (!dims) return null;

    const screen = el.querySelector('.xterm-screen');
    if (!screen) return null;
    const rect = screen.getBoundingClientRect();

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const col = Math.max(0, Math.min(this.terminal.cols - 1, Math.floor(x / dims.cellW)));
    const vpRow = Math.max(0, Math.min(this.terminal.rows - 1, Math.floor(y / dims.cellH)));
    const bufRow = vpRow + this.terminal.buffer.active.viewportY;

    return { col, vpRow, bufRow };
  }

  private cancelLongPress() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // --- Handle positions ---

  getHandlePositions(): HandlePositions | null {
    if (!this.terminal.hasSelection()) return null;
    const dims = this.getCellDims();
    if (!dims) return null;

    const screen = this.terminal.element?.querySelector('.xterm-screen');
    const container = this.containerEl;
    if (!screen || !container) return null;

    const sr = screen.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const ox = sr.left - cr.left;
    const oy = sr.top - cr.top;

    return {
      start: { x: ox + this.selStartCol * dims.cellW, y: oy + (this.selStartRow + 1) * dims.cellH },
      end: { x: ox + (this.selEndCol + 1) * dims.cellW, y: oy + (this.selEndRow + 1) * dims.cellH },
    };
  }

  moveHandle(which: 'start' | 'end', clientX: number, clientY: number): void {
    const pos = this.toBufPos(clientX, clientY);
    if (!pos) return;

    if (which === 'start') { this.selStartCol = pos.col; this.selStartRow = pos.vpRow; }
    else { this.selEndCol = pos.col; this.selEndRow = pos.vpRow; }

    if (this.selStartRow > this.selEndRow || (this.selStartRow === this.selEndRow && this.selStartCol > this.selEndCol)) {
      [this.selStartCol, this.selEndCol] = [this.selEndCol, this.selStartCol];
      [this.selStartRow, this.selEndRow] = [this.selEndRow, this.selStartRow];
    }
    this.applySelection();
  }

  // --- Public actions ---

  copySelection(): string {
    const raw = this.terminal.getSelection();
    const text = raw.split('\n').map((line) => line.trimEnd()).join('\n');
    if (text) navigator.clipboard.writeText(text).catch(() => {});
    return text;
  }

  clearSelection(): void {
    this.terminal.clearSelection();
  }

  selectAll(): void {
    this.terminal.selectAll();
    this.selStartCol = 0;
    this.selStartRow = 0;
    this.selEndCol = this.terminal.cols - 1;
    this.selEndRow = this.terminal.rows - 1;
  }

  async paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text) this.terminal.paste(text);
    } catch { /* clipboard denied */ }
  }
}
