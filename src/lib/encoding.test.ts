import { describe, it, expect } from 'vitest';
import { base64ToUint8Array } from './encoding';

describe('base64ToUint8Array', () => {
  it('decodes simple ASCII', () => {
    const out = base64ToUint8Array('aGVsbG8='); // "hello"
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });

  it('decodes binary bytes (PNG header)', () => {
    // 8-byte PNG signature
    const out = base64ToUint8Array('iVBORw0KGgo=');
    expect(Array.from(out)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('handles empty input', () => {
    expect(base64ToUint8Array('').length).toBe(0);
  });
});
