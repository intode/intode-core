// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isAbsoluteUrl, resolveRelative, dirOf, mimeFor, toDataUri, rewriteCssUrls } from './pipeline';
import { toSrcdoc } from './pipeline';
import type { AssetFetcher } from './pipeline';

describe('isAbsoluteUrl', () => {
  it('treats http/https/data/blob/protocol-relative as absolute', () => {
    expect(isAbsoluteUrl('http://x.com/a.css')).toBe(true);
    expect(isAbsoluteUrl('https://x.com/a.css')).toBe(true);
    expect(isAbsoluteUrl('//x.com/a.css')).toBe(true);
    expect(isAbsoluteUrl('data:text/css,body{}')).toBe(true);
    expect(isAbsoluteUrl('blob:foo')).toBe(true);
  });

  it('treats relative paths as not absolute', () => {
    expect(isAbsoluteUrl('./a.css')).toBe(false);
    expect(isAbsoluteUrl('../a.css')).toBe(false);
    expect(isAbsoluteUrl('img/x.png')).toBe(false);
    expect(isAbsoluteUrl('a.css')).toBe(false);
  });
});

describe('dirOf', () => {
  it('returns directory of a file path', () => {
    expect(dirOf('/home/u/index.html')).toBe('/home/u');
    expect(dirOf('/index.html')).toBe('/');
    expect(dirOf('/a/b/c/d.css')).toBe('/a/b/c');
  });
});

describe('resolveRelative', () => {
  it('joins simple relative path', () => {
    expect(resolveRelative('/home/u', 'style.css')).toBe('/home/u/style.css');
  });
  it('handles ./', () => {
    expect(resolveRelative('/home/u', './style.css')).toBe('/home/u/style.css');
  });
  it('handles ../', () => {
    expect(resolveRelative('/home/u/sub', '../style.css')).toBe('/home/u/style.css');
  });
  it('handles nested subdir', () => {
    expect(resolveRelative('/home/u', './css/main.css')).toBe('/home/u/css/main.css');
  });
  it('handles multiple ../', () => {
    expect(resolveRelative('/a/b/c', '../../x.png')).toBe('/a/x.png');
  });
  it('keeps leading slash on root-anchored input', () => {
    expect(resolveRelative('/a/b', '/abs/x.png')).toBe('/abs/x.png');
  });
  it('preserves tilde prefix when baseDir is ~-rooted', () => {
    expect(resolveRelative('~/foo', './img/x.png')).toBe('~/foo/img/x.png');
    expect(resolveRelative('~/intode-html-test', './img/logo.png')).toBe('~/intode-html-test/img/logo.png');
  });
  it('tilde baseDir with ../ still preserves ~ prefix', () => {
    expect(resolveRelative('~/a/b', '../x.png')).toBe('~/a/x.png');
  });
  it('absolute rel wins over tilde baseDir', () => {
    expect(resolveRelative('~/foo', '/abs/x.png')).toBe('/abs/x.png');
  });
});

describe('mimeFor', () => {
  it('text/css for .css', () => {
    expect(mimeFor('/a/x.css')).toBe('text/css');
  });
  it('application/javascript for .js / .mjs', () => {
    expect(mimeFor('/a/x.js')).toBe('application/javascript');
    expect(mimeFor('/a/x.mjs')).toBe('application/javascript');
  });
  it('image mime types', () => {
    expect(mimeFor('/a/x.png')).toBe('image/png');
    expect(mimeFor('/a/x.jpg')).toBe('image/jpeg');
    expect(mimeFor('/a/x.jpeg')).toBe('image/jpeg');
    expect(mimeFor('/a/x.gif')).toBe('image/gif');
    expect(mimeFor('/a/x.webp')).toBe('image/webp');
    expect(mimeFor('/a/x.svg')).toBe('image/svg+xml');
    expect(mimeFor('/a/x.ico')).toBe('image/x-icon');
  });
  it('font mime types', () => {
    expect(mimeFor('/a/x.woff')).toBe('font/woff');
    expect(mimeFor('/a/x.woff2')).toBe('font/woff2');
    expect(mimeFor('/a/x.ttf')).toBe('font/ttf');
    expect(mimeFor('/a/x.otf')).toBe('font/otf');
  });
  it('octet-stream fallback', () => {
    expect(mimeFor('/a/x.unknownext')).toBe('application/octet-stream');
  });
});

describe('toDataUri', () => {
  it('encodes bytes as base64 data URI with mime', () => {
    const bytes = new Uint8Array([72, 105]); // "Hi"
    expect(toDataUri('text/css', bytes)).toBe('data:text/css;base64,SGk=');
  });

  it('handles empty bytes', () => {
    expect(toDataUri('image/png', new Uint8Array())).toBe('data:image/png;base64,');
  });
});

describe('rewriteCssUrls', () => {
  const mockBytes = (s: string) => new TextEncoder().encode(s);

  it('replaces url(./x.png) with data URI', async () => {
    const fetcher = async (absPath: string) => {
      if (absPath === '/site/x.png') return { mime: 'image/png', bytes: mockBytes('PNG') };
      return null;
    };
    const css = 'body { background: url(./x.png); }';
    const out = await rewriteCssUrls(css, '/site', fetcher);
    expect(out).toContain('url(data:image/png;base64,UE5H)');
  });

  it('handles single + double + no quotes', async () => {
    const fetcher = async () => ({ mime: 'image/png', bytes: mockBytes('X') });
    const css = `a { background: url("./a.png"); } b { background: url('./b.png'); } c { background: url(./c.png); }`;
    const out = await rewriteCssUrls(css, '/s', fetcher);
    expect(out.match(/data:image\/png/g)?.length).toBe(3);
  });

  it('skips absolute URLs', async () => {
    const fetcher = async () => null;
    const css = 'a { background: url(https://x.com/a.png); }';
    const out = await rewriteCssUrls(css, '/s', fetcher);
    expect(out).toBe(css);
  });

  it('keeps original url when fetcher returns null', async () => {
    const fetcher = async () => null;
    const css = 'a { background: url(./missing.png); }';
    const out = await rewriteCssUrls(css, '/s', fetcher);
    expect(out).toBe(css);
  });

  it('resolves baseDir relative to the CSS file location', async () => {
    let captured = '';
    const fetcher = async (absPath: string) => {
      captured = absPath;
      return null;
    };
    // CSS lives at /site/css/, references ../img/x.png → /site/img/x.png
    await rewriteCssUrls('a { background: url(../img/x.png); }', '/site/css', fetcher);
    expect(captured).toBe('/site/img/x.png');
  });
});

describe('toSrcdoc', () => {
  const cssBytes = (s: string) => new TextEncoder().encode(s);

  it('returns input as-is when no resolver and no relative refs', async () => {
    const html = '<html><body><h1>Hi</h1></body></html>';
    const out = await toSrcdoc(html, '/site/index.html', null);
    expect(out).toContain('<h1>Hi</h1>');
  });

  it('inlines <link rel="stylesheet"> via resolver', async () => {
    const fetcher: AssetFetcher = async (abs) =>
      abs === '/site/style.css'
        ? { mime: 'text/css', bytes: cssBytes('body{color:red}') }
        : null;
    const html = '<html><head><link rel="stylesheet" href="./style.css"></head><body></body></html>';
    const out = await toSrcdoc(html, '/site/index.html', fetcher);
    expect(out).toContain('<style>body{color:red}</style>');
    expect(out).not.toContain('<link');
  });

  it('inlines <script src> as inline <script> with text content (data: URIs blocked by sandbox)', async () => {
    const fetcher: AssetFetcher = async (abs) =>
      abs === '/site/app.js'
        ? { mime: 'application/javascript', bytes: cssBytes('console.log(1)') }
        : null;
    const html = '<html><body><script src="./app.js"></script></body></html>';
    const out = await toSrcdoc(html, '/site/index.html', fetcher);
    expect(out).toContain('<script>console.log(1)</script>');
    expect(out).not.toMatch(/src="\.\/app\.js"/);
    expect(out).not.toContain('data:application/javascript');
  });

  it('rewrites <img src>', async () => {
    const fetcher: AssetFetcher = async (abs) =>
      abs === '/site/img/logo.png' ? { mime: 'image/png', bytes: new Uint8Array([1, 2]) } : null;
    const html = '<html><body><img src="./img/logo.png"></body></html>';
    const out = await toSrcdoc(html, '/site/index.html', fetcher);
    expect(out).toContain('data:image/png;base64,');
  });

  it('processes inline <style> url() references', async () => {
    const fetcher: AssetFetcher = async (abs) =>
      abs === '/site/bg.png' ? { mime: 'image/png', bytes: new Uint8Array([1]) } : null;
    const html = '<html><head><style>body{background:url(./bg.png)}</style></head></html>';
    const out = await toSrcdoc(html, '/site/index.html', fetcher);
    expect(out).toContain('url(data:image/png;base64,');
  });

  it('recursively rewrites url() inside fetched CSS files', async () => {
    const fetcher: AssetFetcher = async (abs) => {
      if (abs === '/site/style.css') return { mime: 'text/css', bytes: cssBytes('@font-face{src:url(./fonts/x.woff)}') };
      if (abs === '/site/fonts/x.woff') return { mime: 'font/woff', bytes: new Uint8Array([1]) };
      return null;
    };
    const html = '<html><head><link rel="stylesheet" href="./style.css"></head></html>';
    const out = await toSrcdoc(html, '/site/index.html', fetcher);
    expect(out).toContain('data:font/woff;base64,');
  });

  it('keeps absolute URLs (https://) untouched', async () => {
    const html = '<html><body><img src="https://x.com/a.png"></body></html>';
    const out = await toSrcdoc(html, '/site/index.html', null);
    expect(out).toContain('https://x.com/a.png');
  });

  it('keeps original URL when resolver returns null', async () => {
    const fetcher: AssetFetcher = async () => null;
    const html = '<html><body><img src="./missing.png"></body></html>';
    const out = await toSrcdoc(html, '/site/index.html', fetcher);
    expect(out).toContain('./missing.png');
  });

  it('wraps a bare SVG document in HTML scaffolding', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    const out = await toSrcdoc(svg, '/site/icon.svg', null);
    expect(out).toContain('<svg');
    expect(out).toMatch(/<html|<body/);
  });
});
