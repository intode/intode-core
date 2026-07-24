import { describe, it, expect } from 'vitest';
import { computeDropIndex, computeShift } from './useDragReorder';

describe('computeDropIndex', () => {
  it('stays at start with no movement', () => {
    expect(computeDropIndex(1, 0, 5, 80)).toBe(1);
  });
  it('moves down one slot past half a row', () => {
    expect(computeDropIndex(0, 41, 5, 80)).toBe(1);
  });
  it('rounds to the nearest slot', () => {
    expect(computeDropIndex(0, 120, 5, 80)).toBe(2);
  });
  it('moves up with negative offset', () => {
    expect(computeDropIndex(3, -170, 5, 80)).toBe(1);
  });
  it('clamps at the bottom', () => {
    expect(computeDropIndex(4, 800, 5, 80)).toBe(4);
  });
  it('clamps at the top', () => {
    expect(computeDropIndex(2, -800, 5, 80)).toBe(0);
  });
});

describe('computeShift', () => {
  const H = 80;
  it('shifts items between start and target up when dragging down', () => {
    // dragging index 0 down to index 2: items 1 and 2 move up one slot
    expect(computeShift(1, 0, 2, H)).toBe(-H);
    expect(computeShift(2, 0, 2, H)).toBe(-H);
    expect(computeShift(3, 0, 2, H)).toBe(0);
  });
  it('shifts items between target and start down when dragging up', () => {
    // dragging index 3 up to index 1: items 1 and 2 move down one slot
    expect(computeShift(1, 3, 1, H)).toBe(H);
    expect(computeShift(2, 3, 1, H)).toBe(H);
    expect(computeShift(0, 3, 1, H)).toBe(0);
  });
  it('returns 0 when target equals start', () => {
    expect(computeShift(1, 2, 2, H)).toBe(0);
  });
});
