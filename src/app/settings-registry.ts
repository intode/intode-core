import type React from 'react';

export interface SettingsMenuItem {
  id: string;
  label: string;
  subtitle?: string;
  order: number;
}

export type SettingsPageComponent = React.ComponentType<{ onBack: () => void }>;

const menuItems: SettingsMenuItem[] = [];
const pages = new Map<string, SettingsPageComponent>();

/** Pro calls this to inject menu items (e.g. Subscription) */
export function registerSettingsPage(item: SettingsMenuItem, page: SettingsPageComponent): void {
  menuItems.push(item);
  pages.set(item.id, page);
}

export function getSettingsMenuItems(): SettingsMenuItem[] {
  return [...menuItems].sort((a, b) => a.order - b.order);
}

export function getSettingsPage(id: string): SettingsPageComponent | null {
  return pages.get(id) ?? null;
}
