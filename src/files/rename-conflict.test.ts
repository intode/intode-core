import { describe, it, expect } from 'vitest';
import { resolveRename } from './rename-conflict';

describe('resolveRename', () => {
  it('returns original when no conflict', () => {
    expect(resolveRename('foo.txt', new Set())).toBe('foo.txt');
  });

  it('appends (1) on first conflict', () => {
    expect(resolveRename('foo.txt', new Set(['foo.txt']))).toBe('foo (1).txt');
  });

  it('increments until unique', () => {
    const existing = new Set(['foo.txt', 'foo (1).txt', 'foo (2).txt']);
    expect(resolveRename('foo.txt', existing)).toBe('foo (3).txt');
  });

  it('handles no extension', () => {
    expect(resolveRename('README', new Set(['README']))).toBe('README (1)');
  });

  it('handles multi-dot filename', () => {
    expect(resolveRename('archive.tar.gz', new Set(['archive.tar.gz'])))
      .toBe('archive.tar (1).gz');
  });

  it('handles dotfile', () => {
    expect(resolveRename('.env', new Set(['.env']))).toBe('.env (1)');
  });

  it('throws after 100 attempts', () => {
    const existing = new Set<string>();
    existing.add('foo.txt');
    for (let i = 1; i <= 100; i++) existing.add(`foo (${i}).txt`);
    expect(() => resolveRename('foo.txt', existing)).toThrow(/too many/i);
  });
});
