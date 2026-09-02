import { describe, it, expect, vi, beforeEach } from 'vitest';

const acceptHostKey = vi.fn(async (_o: unknown) => {});
const listKnownHostsRaw = vi.fn(async () => ({ hosts: [] as KnownHostEntry[] }));
const removeKnownHost = vi.fn(async (_o: unknown) => {});
const clearKnownHosts = vi.fn(async () => ({ removed: 0 }));

// The arrows defer the lookups: vi.mock is hoisted above the consts above.
vi.mock('./index', () => ({
  Ssh: {
    acceptHostKey: (...a: unknown[]) => acceptHostKey(a[0]),
    listKnownHosts: () => listKnownHostsRaw(),
    removeKnownHost: (...a: unknown[]) => removeKnownHost(a[0]),
    clearKnownHosts: () => clearKnownHosts(),
  },
}));

import {
  trustHostKey,
  sortKnownHosts,
  listKnownHosts,
  forgetKnownHost,
  forgetAllKnownHosts,
  formatTrustedAt,
} from './host-key';
import type { KnownHostEntry } from './plugin-api';

const entry = (host: string, port: number, extra: Partial<KnownHostEntry> = {}): KnownHostEntry => ({
  host, port, fingerprint: `SHA256:${host}`, ...extra,
});

beforeEach(() => {
  acceptHostKey.mockClear();
  listKnownHostsRaw.mockReset();
  listKnownHostsRaw.mockResolvedValue({ hosts: [] });
  removeKnownHost.mockClear();
  clearKnownHosts.mockReset();
  clearKnownHosts.mockResolvedValue({ removed: 0 });
});

describe('trustHostKey', () => {
  it('carries the key type through so the managed list can name the algorithm', async () => {
    await trustHostKey({ host: 'a.example.com', port: 22, fingerprint: 'SHA256:x', keyType: 'ssh-ed25519' });
    expect(acceptHostKey).toHaveBeenCalledWith({
      host: 'a.example.com', port: 22, fingerprint: 'SHA256:x', keyType: 'ssh-ed25519',
    });
  });
});

describe('sortKnownHosts', () => {
  it('orders by host, then by port as a number', () => {
    const sorted = sortKnownHosts([
      entry('b.example.com', 22),
      entry('a.example.com', 2222),
      entry('a.example.com', 22),
      entry('a.example.com', 222),
    ]);
    expect(sorted.map((h) => `${h.host}:${h.port}`)).toEqual([
      'a.example.com:22',
      'a.example.com:222',
      'a.example.com:2222',
      'b.example.com:22',
    ]);
  });

  it('does not mutate its argument', () => {
    const input = [entry('b', 22), entry('a', 22)];
    sortKnownHosts(input);
    expect(input.map((h) => h.host)).toEqual(['b', 'a']);
  });
});

describe('listKnownHosts', () => {
  it('returns the plugin entries in display order', async () => {
    listKnownHostsRaw.mockResolvedValue({ hosts: [entry('z', 22), entry('a', 22)] });
    expect((await listKnownHosts()).map((h) => h.host)).toEqual(['a', 'z']);
  });

  // A management screen that renders an empty list on failure tells the user they trust
  // nothing — the opposite of the truth, and the one thing it must not be wrong about.
  it('propagates a failure instead of answering "nothing trusted"', async () => {
    listKnownHostsRaw.mockRejectedValue(new Error('keychain locked'));
    await expect(listKnownHosts()).rejects.toThrow('keychain locked');
  });
});

describe('forgetKnownHost', () => {
  it('passes only the identifying pair', async () => {
    await forgetKnownHost({ host: 'a.example.com', port: 2222 });
    expect(removeKnownHost).toHaveBeenCalledWith({ host: 'a.example.com', port: 2222 });
  });
});

describe('forgetAllKnownHosts', () => {
  it('unwraps the removed count', async () => {
    clearKnownHosts.mockResolvedValue({ removed: 3 });
    expect(await forgetAllKnownHosts()).toBe(3);
  });
});

describe('formatTrustedAt', () => {
  it('reads missing and zero as unknown rather than as 1970', () => {
    expect(formatTrustedAt(undefined)).toBe('Unknown');
    expect(formatTrustedAt(0)).toBe('Unknown');
    expect(formatTrustedAt(Number.NaN)).toBe('Unknown');
  });

  it('pads every field so rows line up', () => {
    // Built from the same local calendar the formatter reads, so the assertion holds in
    // any timezone the test runs in — what is being checked is the padding and layout.
    const d = new Date(2026, 8, 2, 4, 5);
    expect(formatTrustedAt(d.getTime())).toBe('2026-09-02 04:05');
  });

  it('answers a stable shape for any instant', () => {
    expect(formatTrustedAt(1712200000000)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
