import React, { useState, useEffect } from 'react';
import { getPolicy } from '../policies/provider';
import { SshKeyList } from '../ssh/components/SshKeyList';
import { getThemeMode, setThemeMode, onThemeChange, type ThemeMode } from '../themes/theme-manager';
import { getSettingsSections } from './settings-registry';

export interface SettingsScreenProps {
  appVersion: string;
  buildNumber: string;
  onBack?: () => void;
  debugEnabled: boolean;
  onDebugToggle: (enabled: boolean) => void;
}

export function SettingsScreen({ appVersion, buildNumber, onBack, debugEnabled, onDebugToggle }: SettingsScreenProps) {
  const { showDebugToggle } = getPolicy();
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode);

  useEffect(() => onThemeChange(setTheme), []);

  const handleTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setTheme(mode);
  };

  return (
    <div style={styles.container}>
      {onBack && (
        <div style={styles.header}>
          <button onClick={onBack} style={styles.backBtn}>{'\u2190'}</button>
          <span style={styles.title}>Settings</span>
        </div>
      )}
      <div style={styles.content}>
        {/* Pro-injected sections (subscription, etc.) */}
        {getSettingsSections().map((Section, i) => <Section key={i} />)}

        {/* Appearance */}
        <div style={styles.section}>
          <span style={styles.sectionTitle}>Appearance</span>
          <div style={styles.row}>
            <span style={styles.label}>Theme</span>
            <div style={styles.themeToggle}>
              {(['system', 'dark', 'light'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleTheme(m)}
                  style={theme === m ? styles.themeActive : styles.themeInactive}
                >
                  {m === 'system' ? 'Auto' : m === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SSH Keys */}
        <div style={styles.section}>
          <span style={styles.sectionTitle}>SSH Keys</span>
          <SshKeyList />
        </div>

        {/* About */}
        <div style={styles.section}>
          <span style={styles.sectionTitle}>About</span>
          <div style={styles.row}>
            <span style={styles.label}>Version</span>
            <span style={styles.value}>{appVersion}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Build</span>
            <span style={styles.value}>{buildNumber}</span>
          </div>
        </div>

        {showDebugToggle && (
          <div style={styles.section}>
            <span style={styles.sectionTitle}>Developer</span>
            <div style={styles.row}>
              <span style={styles.label}>Debug Console</span>
              <button
                onClick={() => onDebugToggle(!debugEnabled)}
                style={{
                  ...styles.toggle,
                  backgroundColor: debugEnabled ? 'var(--accent-blue)' : 'var(--bg-surface1)',
                }}
              >
                <div style={{
                  ...styles.toggleKnob,
                  transform: debugEnabled ? 'translateX(20px)' : 'translateX(0)',
                }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--bg-surface0)' },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 4 },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.3 },
  content: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' as const, letterSpacing: 1.2, display: 'block', marginBottom: 12 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--bg-surface0)' },
  label: { fontSize: 14, color: 'var(--text-primary)' },
  value: { fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' },
  themeToggle: { display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bg-surface1)' },
  themeActive: {
    padding: '6px 12px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
  },
  themeInactive: {
    padding: '6px 12px', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    backgroundColor: 'var(--bg-surface0)', color: 'var(--text-secondary)',
  },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    border: 'none', padding: 4, cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex', alignItems: 'center',
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
};
