import React, { useEffect, useRef, useState } from 'react';
import { toSrcdoc, type AssetFetcher } from './pipeline';
import { getHtmlAssetResolver } from './pipeline-extensions';
import { AssetCache } from './asset-cache';

export interface HtmlPreviewProps {
  content: string;
  filePath: string;
  sftpId: string | null;
  sftpRoot: string;
  visible: boolean;
  /** Bumped by parent (e.g. refresh button) to flush asset cache and refetch. */
  refreshKey: number;
}

export function HtmlPreview({ content, filePath, sftpId, sftpRoot, visible, refreshKey }: HtmlPreviewProps) {
  const cacheRef = useRef(new AssetCache());
  const lastRefreshRef = useRef(refreshKey);
  const [srcdoc, setSrcdoc] = useState('');
  const [loading, setLoading] = useState(true);

  // Flush cache when refreshKey changes
  if (lastRefreshRef.current !== refreshKey) {
    lastRefreshRef.current = refreshKey;
    cacheRef.current.flush();
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const resolver = getHtmlAssetResolver();
    let fetcher: AssetFetcher | null = null;
    if (resolver && sftpId) {
      const ctx = { sftpId, sftpRoot };
      const cache = cacheRef.current;
      fetcher = async (absPath) => {
        const hit = cache.get(absPath);
        if (hit) return hit;
        try {
          const result = await resolver(absPath, dirOfNoTrailing(absPath), ctx);
          if (result) cache.set(absPath, result);
          return result;
        } catch (e) {
          console.warn('[HtmlPreview] resolver error', absPath, e);
          return null;
        }
      };
    }

    toSrcdoc(content, filePath, fetcher).then((html) => {
      if (cancelled) return;
      setSrcdoc(html);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      console.warn('[HtmlPreview] toSrcdoc error', e);
      setSrcdoc(content); // fallback to raw content
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [content, filePath, sftpId, sftpRoot, refreshKey]);

  if (!visible) return null;

  if (loading) {
    return (
      <div style={styles.center}>
        <span style={{ color: 'var(--text-muted)' }}>Rendering...</span>
      </div>
    );
  }

  return (
    <iframe
      title="HTML Preview"
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      style={styles.iframe}
    />
  );
}

// Local helper — for the resolver's baseDir param. Mirrors pipeline.dirOf without
// importing it (it's exported but lives in the same module — direct import is fine).
function dirOfNoTrailing(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return '/';
  return path.substring(0, idx);
}

const styles: Record<string, React.CSSProperties> = {
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'white',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
};
