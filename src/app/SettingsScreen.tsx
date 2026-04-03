import React, { useState, useEffect, useRef } from 'react';
import { getPolicy } from '../policies/provider';
import { SshKeyList } from '../ssh/components/SshKeyList';
import { getThemeMode, setThemeMode, onThemeChange, type ThemeMode } from '../themes/theme-manager';
import { getSettingsMenuItems, getSettingsPage } from './settings-registry';

export interface SettingsScreenProps {
  appVersion: string;
  buildNumber: string;
  onBack: () => void;
  debugEnabled: boolean;
  onDebugToggle: (enabled: boolean) => void;
}

type Page = 'menu' | 'appearance' | 'ssh-keys' | 'about' | 'developer' | string;

// --- Header ---
function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={s.header}>
      <button onClick={onBack} style={s.backBtn}>{'\u2190'}</button>
      <span style={s.headerTitle}>{title}</span>
    </div>
  );
}

// --- Menu item row ---
function MenuItem({ label, subtitle, onClick }: { label: string; subtitle?: string; onClick: () => void }) {
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

function AppearancePage({ onBack }: { onBack: () => void }) {
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

function SshKeysPage({ onBack }: { onBack: () => void }) {
  return (
    <div style={s.page}>
      <PageHeader title="SSH Keys" onBack={onBack} />
      <div style={s.pageContent}>
        <SshKeyList />
      </div>
    </div>
  );
}

function AboutPage({ onBack, appVersion, buildNumber }: { onBack: () => void; appVersion: string; buildNumber: string }) {
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

function DeveloperPage({ onBack, debugEnabled, onDebugToggle }: {
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

function HelpPage({ onBack }: { onBack: () => void }) {
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

// --- Main SettingsScreen ---

export function SettingsScreen({ appVersion, buildNumber, onBack, debugEnabled, onDebugToggle }: SettingsScreenProps) {
  const { showDebugToggle } = getPolicy();
  const [page, setPage] = useState<Page>('menu');
  const proMenuItems = getSettingsMenuItems();

  // Expose sub-page back handler for Android hardware back button
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    (window as any).__intodeSettingsBack = (): boolean => {
      if (pageRef.current !== 'menu') {
        setPage('menu');
        return true;
      }
      return false;
    };
    return () => { delete (window as any).__intodeSettingsBack; };
  }, []);

  if (page !== 'menu') {
    // Render sub-page
    const goMenu = () => setPage('menu');
    if (page === 'appearance') return <AppearancePage onBack={goMenu} />;
    if (page === 'ssh-keys') return <SshKeysPage onBack={goMenu} />;
    if (page === 'about') return <AboutPage onBack={goMenu} appVersion={appVersion} buildNumber={buildNumber} />;
    if (page === 'help') return <HelpPage onBack={goMenu} />;
    if (page === 'developer') return <DeveloperPage onBack={goMenu} debugEnabled={debugEnabled} onDebugToggle={onDebugToggle} />;

    // Pro-injected pages
    const ProPage = getSettingsPage(page);
    if (ProPage) return <ProPage onBack={goMenu} />;
  }

  // Menu
  return (
    <div style={s.page}>
      <PageHeader title="Settings" onBack={onBack} />
      <div style={s.pageContent}>
        {/* Pro-injected items (subscription etc.) */}
        {proMenuItems.map((item) => (
          <MenuItem key={item.id} label={item.label} subtitle={item.subtitle} onClick={() => setPage(item.id)} />
        ))}

        <MenuItem label="Appearance" subtitle={getThemeMode() === 'system' ? 'Auto' : getThemeMode() === 'dark' ? 'Dark' : 'Light'} onClick={() => setPage('appearance')} />
        <MenuItem label="SSH Keys" onClick={() => setPage('ssh-keys')} />
        <MenuItem label="Help Us" subtitle="Bug reports & feature requests" onClick={() => setPage('help')} />
        <MenuItem label="About" subtitle={`v${appVersion}`} onClick={() => setPage('about')} />
        {showDebugToggle && (
          <MenuItem label="Developer" onClick={() => setPage('developer')} />
        )}
      </div>
    </div>
  );
}

// --- Styles ---
const s: Record<string, React.CSSProperties> = {
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
