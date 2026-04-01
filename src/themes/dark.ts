export const DARK_THEME = {
  // Background / Foreground
  '--bg-base': '#1e1e2e',
  '--bg-mantle': '#181825',
  '--bg-crust': '#11111b',
  '--bg-surface0': '#313244',
  '--bg-surface1': '#45475a',
  '--bg-surface2': '#585b70',

  // Text
  '--text-primary': '#cdd6f4',
  '--text-secondary': '#bac2de',
  '--text-tertiary': '#a6adc8',
  '--text-muted': '#6c7086',

  // Accent
  '--accent-blue': '#89b4fa',
  '--accent-green': '#a6e3a1',
  '--accent-red': '#f38ba8',
  '--accent-yellow': '#f9e2af',
  '--accent-mauve': '#cba6f7',
  '--accent-peach': '#fab387',

  // Terminal
  '--term-bg': '#1e1e2e',
  '--term-fg': '#cdd6f4',
  '--term-cursor': '#f5e0dc',
  '--term-selection': '#45475a',
} as const;

export function applyTheme(theme: Record<string, string>): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    root.style.setProperty(key, value);
  }
}
