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
