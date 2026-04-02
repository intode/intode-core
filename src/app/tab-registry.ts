import type React from 'react';

export interface TabDefinition {
  id: string;
  label: string;
  icon: string;
}

export type TabRenderer = React.ComponentType<{ visible: boolean }>;

const extra: TabDefinition[] = [];
const renderers = new Map<string, TabRenderer>();

/** Register a custom tab (called from Pro bootstrap) */
export function registerTab(tab: TabDefinition, renderer: TabRenderer): void {
  extra.push(tab);
  renderers.set(tab.id, renderer);
}

export function getExtraTabs(): TabDefinition[] {
  return extra;
}

export function getTabRenderer(id: string): TabRenderer | undefined {
  return renderers.get(id);
}
