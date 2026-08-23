import React, { useEffect, useState, useRef } from 'react';
import { renderMarkdown } from './pipeline';
import { getPostProcessors } from './pipeline-extensions';
import { PinchZoom } from '../gestures/PinchZoom';
import { MD_PREVIEW_FONT_SIZE } from '../lib/constants';
import './markdown.css';

export interface MarkdownPreviewProps {
  content: string;
  visible: boolean;
  initialScrollTop?: number;
  onScrollChange?: (top: number) => void;
}

export function MarkdownPreview({ content, visible, initialScrollTop, onScrollChange }: MarkdownPreviewProps) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  // Pinch zoom level. Kept in a ref too so re-attaching the gesture (tab switch,
  // re-render) resumes from the size the user last pinched to.
  const [fontSize, setFontSize] = useState(MD_PREVIEW_FONT_SIZE);
  const fontSizeRef = useRef(MD_PREVIEW_FONT_SIZE);
  const onScrollChangeRef = useRef(onScrollChange);
  useEffect(() => { onScrollChangeRef.current = onScrollChange; }, [onScrollChange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    renderMarkdown(content).then((result) => {
      if (!cancelled) {
        setHtml(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [content]);

  // Run post-processors (e.g. mermaid rendering) after HTML is mounted, then restore scroll
  useEffect(() => {
    if (loading || !containerRef.current) return;
    const el = containerRef.current;
    const processors = getPostProcessors();
    for (const fn of processors) {
      fn(el);
    }
    if (initialScrollTop && initialScrollTop > 0) {
      el.scrollTop = initialScrollTop;
    }
  }, [html, loading, initialScrollTop]);

  // Pinch to zoom the whole preview: the container font-size is the em base
  // that every markdown rule scales from.
  useEffect(() => {
    if (loading || !visible || !containerRef.current) return;
    const pinch = new PinchZoom({
      element: containerRef.current,
      initialFontSize: fontSizeRef.current,
      onFontSizeChange: (size) => {
        fontSizeRef.current = size;
        setFontSize(size);
      },
    });
    pinch.attach();
    return () => pinch.detach();
  }, [loading, visible]);

  // Track scroll for per-tab persistence
  useEffect(() => {
    if (loading || !visible || !containerRef.current) return;
    const el = containerRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onScrollChangeRef.current?.(el.scrollTop), 250);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => {
      el.removeEventListener('scroll', handler);
      if (timer) clearTimeout(timer);
    };
  }, [loading, visible]);

  if (!visible) return null;

  if (loading) {
    return (
      <div style={styles.center}>
        <span style={{ color: 'var(--text-muted)' }}>Rendering...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="md-preview"
      style={{ fontSize }}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        if (!(e.target instanceof HTMLElement)) return;
        const anchor = e.target.closest('a');
        if (anchor?.href && (anchor.href.startsWith('http://') || anchor.href.startsWith('https://'))) {
          e.preventDefault();
          window.open(anchor.href, '_system');
        }
      }}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
};
