import type React from 'react';

// === Layout ===
export const CENTER_FLEX: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const CENTER_COLUMN: React.CSSProperties = {
  ...CENTER_FLEX,
  flexDirection: 'column',
};

// === Text ===
export const TRUNCATE: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// === Mobile Touch ===
export const NO_TAP_HIGHLIGHT: React.CSSProperties = {
  WebkitTapHighlightColor: 'transparent',
};

export const TOUCH_SCROLL: React.CSSProperties = {
  WebkitOverflowScrolling: 'touch',
};

// === Buttons ===
const BUTTON_BASE: React.CSSProperties = {
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 500,
  ...NO_TAP_HIGHLIGHT,
};

export const BUTTON_PRIMARY: React.CSSProperties = {
  ...BUTTON_BASE,
  backgroundColor: 'var(--accent-blue)',
  color: 'var(--bg-base)',
  border: 'none',
  padding: '12px 20px',
  fontSize: 15,
  fontWeight: 600,
};

export const BUTTON_SECONDARY: React.CSSProperties = {
  ...BUTTON_BASE,
  background: 'none',
  border: '1px solid var(--bg-surface1)',
  color: 'var(--text-secondary)',
  padding: '10px 20px',
  fontSize: 14,
};

export const BUTTON_OUTLINE_ACCENT: React.CSSProperties = {
  ...BUTTON_BASE,
  background: 'none',
  border: '1px solid var(--accent-blue)',
  color: 'var(--accent-blue)',
  padding: '10px 20px',
  fontSize: 14,
};

// === Input Field ===
export const INPUT_FIELD: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface0)',
  border: '1px solid var(--bg-surface1)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 15,
  outline: 'none',
};

// === Overlay ===
export const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  ...CENTER_FLEX,
  zIndex: 100,
};
