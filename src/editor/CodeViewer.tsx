import React, { useEffect, useRef } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { getLanguageExtension } from './languages';
import { FONT_MONO, TERMINAL_FONT_SIZE } from '../lib/constants';

export interface CodeViewerProps {
  content: string;
  fileName: string;
  visible: boolean;
}

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)',
    height: '100%',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-mantle)',
    color: 'var(--text-muted)',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-surface0)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-surface0)',
  },
  '.cm-cursor': {
    display: 'none',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--bg-surface1) !important',
  },
  '.cm-content': {
    fontFamily: FONT_MONO,
    fontSize: `${TERMINAL_FONT_SIZE}px`,
  },
}, { dark: true });

export function CodeViewer({ content, fileName, visible }: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function init() {
      const container = containerRef.current;
      if (!container) return;
      const extensions: Extension[] = [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        lineNumbers(),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        darkTheme,
        EditorView.lineWrapping,
      ];

      const lang = await getLanguageExtension(fileName);
      if (cancelled) return;
      if (lang) extensions.push(lang);

      const state = EditorState.create({ doc: content, extensions });

      if (viewRef.current) {
        viewRef.current.destroy();
      }

      viewRef.current = new EditorView({
        state,
        parent: container,
      });
    }

    init();

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [content, fileName]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        overflow: 'hidden',
      }}
    />
  );
}
