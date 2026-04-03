import type React from 'react';

export interface PanelEntry {
  id: string;
  label: string;
  component: React.ComponentType<{ visible: boolean }>;
}

const filePanels: PanelEntry[] = [];
const editorPanels: PanelEntry[] = [];

/** Pro injects panels into the Files tab (e.g. Grep Search) */
export function registerFilePanel(entry: PanelEntry): void {
  filePanels.push(entry);
}

/** Pro injects panels into the Editor tab (e.g. Git Status) */
export function registerEditorPanel(entry: PanelEntry): void {
  editorPanels.push(entry);
}

export function getFilePanels(): PanelEntry[] {
  return filePanels;
}

export function getEditorPanels(): PanelEntry[] {
  return editorPanels;
}
