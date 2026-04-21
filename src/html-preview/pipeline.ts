const ABSOLUTE_URL_RE = /^(https?:|data:|blob:|\/\/)/i;

export function isAbsoluteUrl(url: string): boolean {
  return ABSOLUTE_URL_RE.test(url);
}

export function dirOf(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  if (idx <= 0) return '/';
  return filePath.substring(0, idx);
}

/** Join + normalize POSIX-style. If `rel` is root-absolute, returns it normalized.
 * Preserves baseDir's prefix style — `~`-rooted paths stay tilde-prefixed so the
 * SSH plugin can expand them server-side. Only paths whose baseDir starts with `/`
 * (or whose `rel` is itself absolute) get a leading slash. */
export function resolveRelative(baseDir: string, rel: string): string {
  const isAbsRel = rel.startsWith('/');
  const joined = isAbsRel ? rel : baseDir + '/' + rel;
  const parts = joined.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  const prefix = isAbsRel || baseDir.startsWith('/') ? '/' : '';
  return prefix + out.join('/');
}

const MIME_MAP: Record<string, string> = {
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

export function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

export function toDataUri(mime: string, bytes: Uint8Array): string {
  // chunk to avoid stack-overflow on large arrays via String.fromCharCode(...spread)
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Inner abstraction passed by the caller — already wraps cache + resolver + ctx. */
export type AssetFetcher = (absPath: string) => Promise<{ mime: string; bytes: Uint8Array } | null>;

const HTML_ASSET_ATTRS: Array<{ selector: string; attr: string; inlineAs?: 'style' | 'script' }> = [
  { selector: 'link[rel="stylesheet"][href]', attr: 'href', inlineAs: 'style' },
  // <script src> must be inlined as element text; data:application/javascript URIs
  // are blocked by sandboxed iframes (allow-scripts permits inline + same-doc scripts only).
  { selector: 'script[src]', attr: 'src', inlineAs: 'script' },
  { selector: 'img[src]', attr: 'src' },
  { selector: 'source[src]', attr: 'src' },
  { selector: 'video[src]', attr: 'src' },
  { selector: 'audio[src]', attr: 'src' },
  { selector: 'iframe[src]', attr: 'src' },
];

const CSS_URL_RE = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/g;

export async function rewriteCssUrls(css: string, baseDir: string, fetch: AssetFetcher): Promise<string> {
  // Two-pass: collect URLs, fetch in parallel, then replace.
  const urls: string[] = [];
  css.replace(CSS_URL_RE, (_m, q1, q2, q3) => {
    const u = q1 ?? q2 ?? q3;
    urls.push(u);
    return _m;
  });

  const replacements = new Map<string, string>();
  await Promise.all(urls.map(async (u) => {
    if (replacements.has(u)) return;
    if (isAbsoluteUrl(u)) {
      replacements.set(u, u);
      return;
    }
    const abs = resolveRelative(baseDir, u);
    const asset = await fetch(abs);
    replacements.set(u, asset ? toDataUri(asset.mime, asset.bytes) : u);
  }));

  return css.replace(CSS_URL_RE, (_m, q1, q2, q3) => {
    const u = q1 ?? q2 ?? q3;
    const repl = replacements.get(u) ?? u;
    return `url(${repl})`;
  });
}

/** Convert a raw HTML/SVG document into an iframe srcdoc string with relative
 * assets inlined as data URIs. `fetch` is null when no resolver is registered;
 * in that case external <link>/<script src>/<img> refs remain broken (intentional
 * — Pro plugin injects the resolver to make them work). */
export async function toSrcdoc(
  source: string,
  filePath: string,
  fetch: AssetFetcher | null,
): Promise<string> {
  const baseDir = dirOf(filePath);
  const isSvg = filePath.toLowerCase().endsWith('.svg') || /^\s*<\?xml|^\s*<svg/i.test(source);

  let docSource = source;
  if (isSvg && !/<html[\s>]/i.test(source)) {
    docSource = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">${source}</body></html>`;
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(docSource, 'text/html');
  } catch {
    return docSource; // fallback: let WebView native parser handle it
  }

  // Process inline <style> blocks
  if (fetch) {
    const styles = Array.from(doc.querySelectorAll('style'));
    await Promise.all(styles.map(async (el) => {
      const css = el.textContent ?? '';
      el.textContent = await rewriteCssUrls(css, baseDir, fetch);
    }));
  }

  if (fetch) {
    for (const { selector, attr, inlineAs } of HTML_ASSET_ATTRS) {
      const elements = Array.from(doc.querySelectorAll(selector));
      await Promise.all(elements.map(async (el) => {
        const url = el.getAttribute(attr);
        if (!url || isAbsoluteUrl(url)) return;
        const abs = resolveRelative(baseDir, url);
        const asset = await fetch(abs);
        if (!asset) return;

        if (inlineAs === 'style') {
          // Replace <link> with <style> containing fetched CSS (with url() rewrites)
          let cssText = new TextDecoder('utf-8').decode(asset.bytes);
          cssText = await rewriteCssUrls(cssText, dirOf(abs), fetch);
          const styleEl = doc.createElement('style');
          styleEl.textContent = cssText;
          el.replaceWith(styleEl);
        } else if (inlineAs === 'script') {
          // Replace <script src> with inline <script> — sandbox blocks data: scripts.
          // Preserve other attributes (type/defer/async). Drop src.
          const jsText = new TextDecoder('utf-8').decode(asset.bytes);
          const scriptEl = doc.createElement('script');
          for (const a of Array.from(el.attributes)) {
            if (a.name !== 'src') scriptEl.setAttribute(a.name, a.value);
          }
          scriptEl.textContent = jsText;
          el.replaceWith(scriptEl);
        } else {
          el.setAttribute(attr, toDataUri(asset.mime, asset.bytes));
        }
      }));
    }
  }

  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}
