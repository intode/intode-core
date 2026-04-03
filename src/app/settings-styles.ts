import React from 'react';

export const s: Record<string, React.CSSProperties> = {
  page: { height: '100%', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
    borderBottom: '1px solid var(--bg-surface0)', flexShrink: 0,
  },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer', padding: '4px 8px 4px 0' },
  headerTitle: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.3 },
  pageContent: { flex: 1, overflowY: 'auto', padding: '12px 20px' },

  // Menu
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '16px 0', background: 'none', border: 'none',
    borderBottom: '1px solid var(--bg-surface0)', cursor: 'pointer', textAlign: 'left',
  },
  menuLabel: { fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 },
  menuSub: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  menuArrow: { fontSize: 20, color: 'var(--text-muted)', fontWeight: 300 },

  // Section
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)',
    textTransform: 'uppercase' as const, letterSpacing: 1.2, display: 'block', marginBottom: 12,
  },

  // Row
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid var(--bg-surface0)',
  },
  rowLabel: { fontSize: 14, color: 'var(--text-primary)' },
  rowValue: { fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' },

  // Theme
  themeGrid: { display: 'flex', gap: 12 },
  themeCard: {
    flex: 1, padding: 12, backgroundColor: 'var(--bg-surface0)', borderRadius: 10,
    border: '2px solid transparent', cursor: 'pointer', textAlign: 'center',
  },
  themeCardActive: {
    flex: 1, padding: 12, backgroundColor: 'var(--bg-surface0)', borderRadius: 10,
    border: '2px solid var(--accent-blue)', cursor: 'pointer', textAlign: 'center',
  },
  themePreview: {
    width: '100%', height: 48, borderRadius: 6, marginBottom: 8,
  },
  themeLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },

  // Toggle
  toggle: {
    width: 48, height: 28, borderRadius: 14, border: 'none', padding: 4,
    cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center',
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: '50%', backgroundColor: 'white',
    transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },

  // About
  aboutLogo: {
    fontSize: 28, fontWeight: 700, color: 'var(--accent-blue)', textAlign: 'center',
    letterSpacing: 4, marginTop: 20, marginBottom: 4,
    fontFamily: 'Chakra Petch, sans-serif',
  },
  aboutTagline: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 32 },
};
