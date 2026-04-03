/** Pipeline extension registry — Pro injects remark/rehype plugins here */

type PluginEntry = [plugin: any, options?: any];

const remarkExtensions: PluginEntry[] = [];
const rehypeExtensions: PluginEntry[] = [];
const postProcessors: Array<(container: HTMLElement) => void | Promise<void>> = [];

export function registerRemarkPlugin(plugin: any, options?: any): void {
  remarkExtensions.push(options ? [plugin, options] : [plugin]);
}

export function registerRehypePlugin(plugin: any, options?: any): void {
  rehypeExtensions.push(options ? [plugin, options] : [plugin]);
}

/** Post-process rendered HTML (e.g. mermaid code blocks → SVG) */
export function registerPostProcessor(fn: (container: HTMLElement) => void | Promise<void>): void {
  postProcessors.push(fn);
}

export function getRemarkExtensions(): PluginEntry[] {
  return remarkExtensions;
}

export function getRehypeExtensions(): PluginEntry[] {
  return rehypeExtensions;
}

export function getPostProcessors(): typeof postProcessors {
  return postProcessors;
}
