import type { MarkdownPlugin, EditorPlugin } from './types';

const markdownPlugins: MarkdownPlugin[] = [];
const editorPlugins: EditorPlugin[] = [];

export function registerMarkdownPlugin(plugin: MarkdownPlugin): void {
  markdownPlugins.push(plugin);
}

export function getMarkdownPlugins(): readonly MarkdownPlugin[] {
  return markdownPlugins;
}

export function getPluginForLang(lang: string): MarkdownPlugin | null {
  return markdownPlugins.find(p => p.canHandle(lang)) ?? null;
}

export function registerEditorPlugin(plugin: EditorPlugin): void {
  editorPlugins.push(plugin);
}

export function getEditorPlugins(): readonly EditorPlugin[] {
  return editorPlugins;
}
