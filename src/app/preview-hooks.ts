/** DI hook for opening URLs in the Preview tab (Pro injects) */

type OpenPreviewFn = (url: string) => void;

let openFn: OpenPreviewFn | null = null;

export function setOpenPreviewHook(fn: OpenPreviewFn): void {
  openFn = fn;
}

export function openInPreview(url: string): boolean {
  if (!openFn) return false;
  openFn(url);
  return true;
}
