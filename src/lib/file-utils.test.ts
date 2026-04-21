import { describe, it, expect } from 'vitest';
import { detectFileType, getExtension, getFileName } from './file-utils';

describe('detectFileType', () => {
  it('returns "markdown" for .md', () => {
    expect(detectFileType('README.md')).toBe('markdown');
  });

  it('returns "html" for .html / .htm / .xhtml / .svg', () => {
    expect(detectFileType('index.html')).toBe('html');
    expect(detectFileType('page.htm')).toBe('html');
    expect(detectFileType('doc.xhtml')).toBe('html');
    expect(detectFileType('icon.svg')).toBe('html');
  });

  it('returns "binary" for image extensions other than svg', () => {
    expect(detectFileType('photo.png')).toBe('binary');
    expect(detectFileType('photo.jpg')).toBe('binary');
  });

  it('returns "code" for unknown extensions', () => {
    expect(detectFileType('app.ts')).toBe('code');
    expect(detectFileType('Makefile')).toBe('code');
  });
});

describe('getExtension', () => {
  it('extracts extension lowercase', () => {
    expect(getExtension('FOO.HTML')).toBe('html');
  });
  it('returns empty for no extension', () => {
    expect(getExtension('Makefile')).toBe('');
  });
});

describe('getFileName', () => {
  it('returns last segment', () => {
    expect(getFileName('/a/b/c.txt')).toBe('c.txt');
  });
});
