import React, { useState, useEffect } from 'react';
import { SshKeyList } from '../ssh/components/SshKeyList';
import { getThemeMode, setThemeMode, onThemeChange, type ThemeMode } from '../themes/theme-manager';
import { s } from './settings-styles';

// --- Shared components ---

export function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={s.header}>
      <button onClick={onBack} style={s.backBtn}>{'\u2190'}</button>
      <span style={s.headerTitle}>{title}</span>
    </div>
  );
}

export function MenuItem({ label, subtitle, onClick }: { label: string; subtitle?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={s.menuItem}>
      <div style={{ flex: 1 }}>
        <div style={s.menuLabel}>{label}</div>
        {subtitle && <div style={s.menuSub}>{subtitle}</div>}
      </div>
      <span style={s.menuArrow}>{'\u203A'}</span>
    </button>
  );
}

// --- Sub-pages ---

export function AppearancePage({ onBack }: { onBack: () => void }) {
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode);
  useEffect(() => onThemeChange(setTheme), []);

  return (
    <div style={s.page}>
      <PageHeader title="Appearance" onBack={onBack} />
      <div style={s.pageContent}>
        <div style={s.section}>
          <span style={s.sectionTitle}>Theme</span>
          <div style={s.themeGrid}>
            {(['system', 'dark', 'light'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setThemeMode(m); setTheme(m); }}
                style={theme === m ? s.themeCardActive : s.themeCard}
              >
                <div style={{
                  ...s.themePreview,
                  backgroundColor: m === 'light' ? '#f5f5f5' : m === 'dark' ? '#030303' : 'linear-gradient(135deg, #030303 50%, #f5f5f5 50%)',
                  background: m === 'system' ? 'linear-gradient(135deg, #030303 50%, #f5f5f5 50%)' : undefined,
                }} />
                <span style={s.themeLabel}>
                  {m === 'system' ? 'Auto' : m === 'dark' ? 'Dark' : 'Light'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SshKeysPage({ onBack }: { onBack: () => void }) {
  return (
    <div style={s.page}>
      <PageHeader title="SSH Keys" onBack={onBack} />
      <div style={s.pageContent}>
        <SshKeyList />
      </div>
    </div>
  );
}

export function AboutPage({ onBack, appVersion, buildNumber }: { onBack: () => void; appVersion: string; buildNumber: string }) {
  return (
    <div style={s.page}>
      <PageHeader title="About" onBack={onBack} />
      <div style={s.pageContent}>
        <div style={s.aboutLogo}>INTODE</div>
        <p style={s.aboutTagline}>Mobile SSH IDE</p>

        <div style={s.section}>
          <div style={s.row}>
            <span style={s.rowLabel}>Version</span>
            <span style={s.rowValue}>{appVersion}</span>
          </div>
          <div style={s.row}>
            <span style={s.rowLabel}>Build</span>
            <span style={s.rowValue}>{buildNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeveloperPage({ onBack, debugEnabled, onDebugToggle }: {
  onBack: () => void; debugEnabled: boolean; onDebugToggle: (v: boolean) => void;
}) {
  return (
    <div style={s.page}>
      <PageHeader title="Developer" onBack={onBack} />
      <div style={s.pageContent}>
        <div style={s.section}>
          <div style={s.row}>
            <span style={s.rowLabel}>Debug Console</span>
            <button
              onClick={() => onDebugToggle(!debugEnabled)}
              style={{ ...s.toggle, backgroundColor: debugEnabled ? 'var(--accent-blue)' : 'var(--bg-surface1)' }}
            >
              <div style={{ ...s.toggleKnob, transform: debugEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpPage({ onBack }: { onBack: () => void }) {
  const email = 'support@mintcinc.com';
  return (
    <div style={s.page}>
      <PageHeader title="Help Us" onBack={onBack} />
      <div style={s.pageContent}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{'\uD83D\uDC4B'}</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            We'd love to hear from you
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
            Found a bug? Have a feature idea?{'\n'}
            Don't hesitate to reach out — every message helps us make Intode better.
          </p>
          <button
            onClick={() => { window.open(`mailto:${email}?subject=Intode%20Feedback`, '_system'); }}
            style={{
              padding: '14px 28px', backgroundColor: 'var(--accent-blue)', color: 'var(--bg-base)',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              width: '100%', marginBottom: 12,
            }}
          >
            Send Email
          </button>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{email}</p>
        </div>
      </div>
    </div>
  );
}
