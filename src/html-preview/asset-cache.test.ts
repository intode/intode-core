import { describe, it, expect, beforeEach } from 'vitest';
import { AssetCache } from './asset-cache';

describe('AssetCache', () => {
  let cache: AssetCache;
  beforeEach(() => { cache = new AssetCache(); });

  it('returns undefined for missing key', () => {
    expect(cache.get('/a/b.css')).toBeUndefined();
  });

  it('stores and retrieves an asset', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    cache.set('/a/b.css', { mime: 'text/css', bytes });
    expect(cache.get('/a/b.css')).toEqual({ mime: 'text/css', bytes });
  });

  it('flush clears all entries', () => {
    cache.set('/a.css', { mime: 'text/css', bytes: new Uint8Array() });
    cache.set('/b.png', { mime: 'image/png', bytes: new Uint8Array() });
    cache.flush();
    expect(cache.get('/a.css')).toBeUndefined();
    expect(cache.get('/b.png')).toBeUndefined();
  });

  it('overwrites existing entries on set', () => {
    cache.set('/a.css', { mime: 'text/css', bytes: new Uint8Array([1]) });
    cache.set('/a.css', { mime: 'text/css', bytes: new Uint8Array([2]) });
    expect(cache.get('/a.css')?.bytes[0]).toBe(2);
  });
});
