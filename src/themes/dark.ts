export const DARK_THEME = {
  // Background / Foreground — Cyberpunk Obsidian
  '--bg-base': '#030303',
  '--bg-mantle': '#0a0c0a',
  '--bg-crust': '#000000',
  '--bg-surface0': '#1a241c',
  '--bg-surface1': '#2a3a2e',
  '--bg-surface2': '#3d5242',

  // Text
  '--text-primary': '#e6e6e6',
  '--text-secondary': '#8b928c',
  '--text-tertiary': '#6c756e',
  '--text-muted': '#525a54',

  // Accent — Neon Green & Cyber Orange
  '--accent-blue': '#00ff66',
  '--accent-green': '#00ff66',
  '--accent-red': '#ff3300',
  '--accent-yellow': '#ffcc00',
  '--accent-mauve': '#00ff66',
  '--accent-peach': '#ff3300',

  // Terminal
  '--term-bg': '#030303',
  '--term-fg': '#00ff66',
  '--term-cursor': '#00ff66',
  '--term-selection': 'rgba(0, 255, 102, 0.2)',
} as const;

export function applyTheme(theme: Record<string, string>): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    root.style.setProperty(key, value);
  }
}
