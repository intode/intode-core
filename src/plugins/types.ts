export interface MarkdownPlugin {
  name: string;
  canHandle(lang: string): boolean;
  render(code: string, el: HTMLElement): void | Promise<void>;
}

export interface EditorPlugin {
  name: string;
  activate(): void;
  deactivate(): void;
}
