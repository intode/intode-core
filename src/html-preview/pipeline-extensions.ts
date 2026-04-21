/** HTML preview asset resolver — Pro injects SFTP-based implementation here */

export interface HtmlAssetContext {
  /** SFTP session id for the active workspace */
  sftpId: string;
  /** Workspace root path; resolver MUST refuse paths outside this prefix */
  sftpRoot: string;
}

export type HtmlAssetResolver = (
  url: string,
  baseDir: string,
  ctx: HtmlAssetContext,
) => Promise<{ mime: string; bytes: Uint8Array } | null>;

let resolver: HtmlAssetResolver | null = null;

export function setHtmlAssetResolver(fn: HtmlAssetResolver | null): void {
  resolver = fn;
}

export function getHtmlAssetResolver(): HtmlAssetResolver | null {
  return resolver;
}
