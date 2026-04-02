import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import {
  defaultKeymap, historyKeymap, indentWithTab, history, undo, redo,
  cursorLineUp, cursorLineDown, cursorCharLeft, cursorCharRight,
} from '@codemirror/commands';
import { getLanguageExtension } from './languages';
import { PinchZoom } from '../gestures/PinchZoom';
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
  save(): void;
  insertText(text: string): void;
  setFontSize(size: number): void;
  cursorUp(): void;
  cursorDown(): void;
  cursorLeft(): void;
  cursorRight(): void;
  wrapSelection(before: string, after: string): void;
  prependLine(prefix: string): void;
}

// Global ref for active editor — used by ExtraKeyBar routing in App.tsx
let activeEditorApi: CodeEditorRef | null = null;
export function getActiveEditorApi(): CodeEditorRef | null { return activeEditorApi; }

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
    const pinchRef = useRef<PinchZoom | null>(null);
    const onContentChangeRef = useRef(onContentChange);
    const onSaveRef = useRef(onSave);
    onContentChangeRef.current = onContentChange;
    onSaveRef.current = onSave;

    const api: CodeEditorRef = {
      undo() { if (viewRef.current) undo(viewRef.current); },
      redo() { if (viewRef.current) redo(viewRef.current); },
      save() { onSaveRef.current?.(); },
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
      cursorUp() { if (viewRef.current) cursorLineUp(viewRef.current); },
      cursorDown() { if (viewRef.current) cursorLineDown(viewRef.current); },
      cursorLeft() { if (viewRef.current) cursorCharLeft(viewRef.current); },
      cursorRight() { if (viewRef.current) cursorCharRight(viewRef.current); },
      wrapSelection(before: string, after: string) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        if (from === to) {
          // No selection: insert before+after and place cursor between
          view.dispatch({
            changes: { from, insert: before + after },
            selection: { anchor: from + before.length },
          });
        } else {
          // Wrap selection
          const selected = view.state.sliceDoc(from, to);
          view.dispatch({
            changes: { from, to, insert: before + selected + after },
            selection: { anchor: from + before.length, head: from + before.length + selected.length },
          });
        }
        view.focus();
      },
      prependLine(prefix: string) {
        const view = viewRef.current;
        if (!view) return;
        const line = view.state.doc.lineAt(view.state.selection.main.head);
        const text = line.text;
        // Cycle heading levels: # → ## → ### → #### → #
        if (prefix === '# ') {
          const match = text.match(/^(#{1,4})\s/);
          if (match) {
            const level = match[1].length;
            const next = level >= 4 ? 1 : level + 1;
            const newPrefix = '#'.repeat(next) + ' ';
            view.dispatch({ changes: { from: line.from, to: line.from + match[0].length, insert: newPrefix } });
          } else {
            view.dispatch({ changes: { from: line.from, insert: prefix } });
          }
        } else if (text.startsWith(prefix)) {
          // Already has prefix: for list items, indent; for others, toggle off
          if (prefix === '- ' || prefix === '> ') {
            view.dispatch({ changes: { from: line.from, insert: '  ' } });
          } else {
            view.dispatch({ changes: { from: line.from, to: line.from + prefix.length, insert: '' } });
          }
        } else {
          view.dispatch({ changes: { from: line.from, insert: prefix } });
        }
        view.focus();
      },
    };

    useImperativeHandle(ref, () => api);

    // Register/unregister as active editor for ExtraKeyBar routing
    useEffect(() => {
      if (visible) activeEditorApi = api;
      return () => { if (activeEditorApi === api) activeEditorApi = null; };
    }, [visible]);

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
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
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

        // Pinch zoom for editor font size
        pinchRef.current?.detach();
        const pinch = new PinchZoom({
          element: container,
          initialFontSize: TERMINAL_FONT_SIZE,
          onFontSizeChange: (size) => api.setFontSize(size),
        });
        pinch.attach();
        pinchRef.current = pinch;
      }

      init();

      return () => {
        cancelled = true;
        pinchRef.current?.detach();
        pinchRef.current = null;
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
