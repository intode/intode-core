import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { defaultKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { getLanguageExtension } from './languages';
import { FONT_MONO, TERMINAL_FONT_SIZE } from '../lib/constants';

export interface CodeEditorProps {
  content: string;
  fileName: string;
  visible: boolean;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
}

export interface CodeEditorRef {
  undo(): void;
  redo(): void;
  insertText(text: string): void;
  setFontSize(size: number): void;
}

const fontSizeCompartment = new Compartment();

function makeFontSizeTheme(size: number) {
  return EditorView.theme({
    '.cm-content': {
      fontFamily: FONT_MONO,
      fontSize: `${size}px`,
    },
  });
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
    borderLeftColor: 'var(--accent-blue)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--bg-surface1) !important',
  },
}, { dark: true });

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
  function CodeEditor({ content, fileName, visible, onContentChange, onSave }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onContentChangeRef = useRef(onContentChange);
    const onSaveRef = useRef(onSave);
    onContentChangeRef.current = onContentChange;
    onSaveRef.current = onSave;

    useImperativeHandle(ref, () => ({
      undo() { if (viewRef.current) undo(viewRef.current); },
      redo() { if (viewRef.current) redo(viewRef.current); },
      insertText(text: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(view.state.replaceSelection(text));
        view.focus();
      },
      setFontSize(size: number) {
        viewRef.current?.dispatch({
          effects: fontSizeCompartment.reconfigure(makeFontSizeTheme(size)),
        });
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      let cancelled = false;

      async function init() {
        const container = containerRef.current;
        if (!container) return;

        const extensions: Extension[] = [
          lineNumbers(),
          highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          darkTheme,
          fontSizeCompartment.of(makeFontSizeTheme(TERMINAL_FONT_SIZE)),
          EditorView.lineWrapping,
          keymap.of([
            ...defaultKeymap,
            indentWithTab,
            { key: 'Mod-s', run: () => { onSaveRef.current?.(); return true; } },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onContentChangeRef.current?.(update.state.doc.toString());
            }
          }),
        ];

        const lang = await getLanguageExtension(fileName);
        if (cancelled) return;
        if (lang) extensions.push(lang);

        const state = EditorState.create({ doc: content, extensions });

        if (viewRef.current) viewRef.current.destroy();
        viewRef.current = new EditorView({ state, parent: container });
      }

      init();

      return () => {
        cancelled = true;
        viewRef.current?.destroy();
        viewRef.current = null;
      };
    }, [fileName]);

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
  },
);
