import type { Terminal } from '@xterm/xterm';
import { LONG_PRESS_DELAY_MS } from '../lib/constants';

const MOVE_THRESHOLD = 10;

export interface HandlePositions {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface SelectionCallbacks {
  onSelectionStart: () => void;
  onSelectionChange: (hasSelection: boolean) => void;
}

export class TerminalSelection {
  private longPressTimer: number | null = null;
  private isDragging = false;
  private wasMoved = false;
  private startTouch: { x: number; y: number } | null = null;
  private anchorCol = 0;
  private anchorRow = 0;
  private selStartCol = 0;
  private selStartRow = 0;
  private selEndCol = 0;
  private selEndRow = 0;
  private containerEl: HTMLElement | null = null;
  private disposables: (() => void)[] = [];

  /** Set true during handle drag to suppress terminal touch events */
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

    element.addEventListener('touchstart', onTouchStart, { passive: true });
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
    const t = e.touches[0];
    this.startTouch = { x: t.clientX, y: t.clientY };
    this.wasMoved = false;
    this.isDragging = false;

    this.longPressTimer = window.setTimeout(() => {
      this.beginSelection(t.clientX, t.clientY);
    }, LONG_PRESS_DELAY_MS);
  }

  private onTouchMove(e: TouchEvent) {
    if (this.isHandleDrag) return;
    if (!this.startTouch || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - this.startTouch.x;
    const dy = t.clientY - this.startTouch.y;

    if (!this.isDragging) {
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
        this.cancelLongPress();
        this.wasMoved = true;
      }
      return;
    }

    e.preventDefault();
    this.extendTo(t.clientX, t.clientY);
  }

  private onTouchEnd() {
    if (this.isHandleDrag) return;
    const wasSelecting = this.isDragging;
    this.cancelLongPress();
    this.isDragging = false;

    if (!wasSelecting && !this.wasMoved && this.terminal.hasSelection()) {
      this.terminal.clearSelection();
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

  // --- Handle positions (relative to container) ---

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
      start: {
        x: ox + this.selStartCol * dims.cellW,
        y: oy + (this.selStartRow + 1) * dims.cellH,
      },
      end: {
        x: ox + (this.selEndCol + 1) * dims.cellW,
        y: oy + (this.selEndRow + 1) * dims.cellH,
      },
    };
  }

  moveHandle(which: 'start' | 'end', clientX: number, clientY: number): void {
    const pos = this.toBufPos(clientX, clientY);
    if (!pos) return;

    if (which === 'start') {
      this.selStartCol = pos.col;
      this.selStartRow = pos.vpRow;
    } else {
      this.selEndCol = pos.col;
      this.selEndRow = pos.vpRow;
    }

    // Ensure start <= end
    if (this.selStartRow > this.selEndRow ||
        (this.selStartRow === this.selEndRow && this.selStartCol > this.selEndCol)) {
      [this.selStartCol, this.selEndCol] = [this.selEndCol, this.selStartCol];
      [this.selStartRow, this.selEndRow] = [this.selEndRow, this.selStartRow];
    }

    this.applySelection();
  }

  // --- Public actions ---

  copySelection(): string {
    const text = this.terminal.getSelection();
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
