import { describe, it, expect, afterEach } from 'vitest';
import { getSshCapabilities, setSshCapabilities, type SshCapabilities } from './capabilities';

const KEYS: Array<keyof SshCapabilities> = [
  'shell', 'fileOps', 'keyManagement', 'keyAuth', 'fileTransfer', 'mediaCache',
];

afterEach(() => {
  // Module state is global; put it back so test order cannot matter.
  setSshCapabilities({});
});

describe('ssh capabilities', () => {
  it('is unrestricted when the host injects nothing', () => {
    for (const k of KEYS) expect(getSshCapabilities()[k]).toBe(true);
  });

  it('turns off only what was named', () => {
    setSshCapabilities({ shell: false });
    const caps = getSshCapabilities();
    expect(caps.shell).toBe(false);
    for (const k of KEYS.filter((k) => k !== 'shell')) expect(caps[k]).toBe(true);
  });

  it('replaces the previous injection instead of accumulating', () => {
    setSshCapabilities({ shell: false, fileOps: false });
    setSshCapabilities({ mediaCache: false });
    const caps = getSshCapabilities();
    expect(caps.mediaCache).toBe(false);
    expect(caps.shell).toBe(true);
    expect(caps.fileOps).toBe(true);
  });

  it('never throws, whatever the call order', () => {
    expect(() => getSshCapabilities()).not.toThrow();
    expect(() => setSshCapabilities({})).not.toThrow();
    expect(() => getSshCapabilities()).not.toThrow();
    expect(() => setSshCapabilities({ keyAuth: false })).not.toThrow();
    expect(() => getSshCapabilities()).not.toThrow();
  });

  it('hands out the same object shape every time', () => {
    setSshCapabilities({ keyAuth: false });
    expect(Object.keys(getSshCapabilities()).sort()).toEqual([...KEYS].sort());
  });
});
