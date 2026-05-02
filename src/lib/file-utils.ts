const MARKDOWN_EXTS = ['md', 'mdx', 'markdown'];
const HTML_EXTS = ['html', 'htm', 'xhtml', 'svg'];
const BINARY_EXTS = [
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico',
  'exe', 'dll', 'so', 'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'mp3', 'mp4', 'pdf', 'wasm', 'class', 'pyc',
];

/** Extract file extension from filename (lowercase) */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/** Extract filename from path */
export function getFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Detect file type by extension */
export function detectFileType(filename: string): 'code' | 'markdown' | 'html' | 'binary' {
  const ext = getExtension(filename);
  if (MARKDOWN_EXTS.includes(ext)) return 'markdown';
  if (HTML_EXTS.includes(ext)) return 'html';
  if (BINARY_EXTS.includes(ext)) return 'binary';
  return 'code';
}

const MIME_MAP: Record<string, string> = {
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  bmp: 'image/bmp', ico: 'image/x-icon',
  // audio
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac',
  // video
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  // text/code
  txt: 'text/plain', md: 'text/markdown',
  json: 'application/json', xml: 'application/xml',
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'application/javascript',
  // archive / doc
  pdf: 'application/pdf', zip: 'application/zip',
  tar: 'application/x-tar', gz: 'application/gzip',
};

/** Best-effort MIME from extension. Falls back to octet-stream. */
export function getMimeType(filename: string): string {
  return MIME_MAP[getExtension(filename)] ?? 'application/octet-stream';
}
