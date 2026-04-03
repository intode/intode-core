import type React from 'react';

type SettingsSection = React.ComponentType;

const sections: SettingsSection[] = [];

/** Pro calls this at bootstrap to inject subscription UI etc. */
export function registerSettingsSection(section: SettingsSection): void {
  sections.push(section);
}

export function getSettingsSections(): SettingsSection[] {
  return [...sections];
}
