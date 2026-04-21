export interface CachedAsset {
  mime: string;
  bytes: Uint8Array;
}

/** Per-tab cache for resolved HTML preview assets (CSS/JS/images/fonts).
 * Keyed by absolute path. Flush on user-triggered refresh. */
export class AssetCache {
  private store = new Map<string, CachedAsset>();

  get(absPath: string): CachedAsset | undefined {
    return this.store.get(absPath);
  }

  set(absPath: string, asset: CachedAsset): void {
    this.store.set(absPath, asset);
  }

  flush(): void {
    this.store.clear();
  }
}
