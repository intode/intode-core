import React, { useEffect, useState, useRef } from 'react';
import { renderMarkdown } from './pipeline';
import { getPostProcessors } from './pipeline-extensions';
import './markdown.css';

export interface MarkdownPreviewProps {
  content: string;
  visible: boolean;
}

export function MarkdownPreview({ content, visible }: MarkdownPreviewProps) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Run post-processors (e.g. mermaid rendering) after HTML is mounted
  useEffect(() => {
    if (loading || !containerRef.current) return;
    const processors = getPostProcessors();
    for (const fn of processors) {
      fn(containerRef.current);
    }
  }, [html, loading]);

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
