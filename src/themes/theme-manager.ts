import { DARK_THEME, applyTheme } from './dark';
import { LIGHT_THEME } from './light';
import { XTERM_THEME, XTERM_LIGHT_THEME } from '../lib/constants';

export type ThemeMode = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'intode_theme';

let currentMode: ThemeMode = 'dark';
let listeners: Array<(mode: ThemeMode) => void> = [];

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyResolvedTheme(resolved: 'dark' | 'light') {
  const theme = resolved === 'dark' ? DARK_THEME : LIGHT_THEME;
  applyTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);

  // Toggle scanline/grid effects (dark only)
  document.body.classList.toggle('theme-dark', resolved === 'dark');
  document.body.classList.toggle('theme-light', resolved === 'light');

  // Update status bar color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#030303' : '#f5f5f5');
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode): void {
  currentMode = mode;
  localStorage.setItem(STORAGE_KEY, mode);
  applyResolvedTheme(resolveTheme(mode));
  listeners.forEach((fn) => fn(mode));
}

export function onThemeChange(fn: (mode: ThemeMode) => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function getXtermTheme(): Record<string, string> {
  return resolveTheme(currentMode) === 'dark' ? { ...XTERM_THEME } : { ...XTERM_LIGHT_THEME };
}

export function initTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  currentMode = saved ?? 'dark';
  applyResolvedTheme(resolveTheme(currentMode));

  // Listen for system theme changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (currentMode === 'system') {
      applyResolvedTheme(resolveTheme('system'));
    }
  });
}
