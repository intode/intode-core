import { describe, it, expect } from 'vitest';
import { detectFileType, detectMediaKind, getExtension, getFileName, getMimeType } from './file-utils';

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

  it('returns "media" for image extensions (other than svg)', () => {
    expect(detectFileType('photo.png')).toBe('media');
    expect(detectFileType('photo.jpg')).toBe('media');
  });

  it('returns "code" for unknown extensions', () => {
    expect(detectFileType('app.ts')).toBe('code');
    expect(detectFileType('Makefile')).toBe('code');
  });
});

describe('detectFileType — media branch', () => {
  it('classifies image extensions as media', () => {
    expect(detectFileType('photo.png')).toBe('media');
    expect(detectFileType('photo.JPG')).toBe('media');
    expect(detectFileType('icon.gif')).toBe('media');
    expect(detectFileType('anim.webp')).toBe('media');
  });

  it('classifies audio extensions as media', () => {
    expect(detectFileType('song.mp3')).toBe('media');
    expect(detectFileType('voice.wav')).toBe('media');
    expect(detectFileType('clip.m4a')).toBe('media');
  });

  it('classifies video extensions as media', () => {
    expect(detectFileType('movie.mp4')).toBe('media');
    expect(detectFileType('clip.webm')).toBe('media');
  });

  it('keeps svg as html (HtmlPreview handles SVG)', () => {
    expect(detectFileType('icon.svg')).toBe('html');
  });

  it('keeps non-media binaries as binary', () => {
    expect(detectFileType('archive.zip')).toBe('binary');
    expect(detectFileType('book.pdf')).toBe('binary');
  });
});

describe('detectMediaKind', () => {
  it('returns image for image extensions', () => {
    expect(detectMediaKind('photo.png')).toBe('image');
    expect(detectMediaKind('photo.JPG')).toBe('image');
  });

  it('returns audio for audio extensions', () => {
    expect(detectMediaKind('song.mp3')).toBe('audio');
  });

  it('returns video for video extensions', () => {
    expect(detectMediaKind('clip.mp4')).toBe('video');
  });

  it('returns null for non-media', () => {
    expect(detectMediaKind('app.ts')).toBeNull();
    expect(detectMediaKind('icon.svg')).toBeNull();
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

describe('getMimeType', () => {
  it('maps common image extensions', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('photo.JPG')).toBe('image/jpeg');
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(getMimeType('image.png')).toBe('image/png');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
  });

  it('maps audio and video', () => {
    expect(getMimeType('song.mp3')).toBe('audio/mpeg');
    expect(getMimeType('clip.mp4')).toBe('video/mp4');
    expect(getMimeType('clip.webm')).toBe('video/webm');
  });

  it('falls back to octet-stream for unknown', () => {
    expect(getMimeType('weird.zzz')).toBe('application/octet-stream');
    expect(getMimeType('Makefile')).toBe('application/octet-stream');
  });

  it('handles names without extension', () => {
    expect(getMimeType('README')).toBe('application/octet-stream');
  });
});
