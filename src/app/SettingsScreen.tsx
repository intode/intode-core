import React from 'react';

export interface SettingsScreenProps {
  appVersion: string;
  buildNumber: string;
  onBack: () => void;
}

export function SettingsScreen({ appVersion, buildNumber, onBack }: SettingsScreenProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>←</button>
        <span style={styles.title}>Settings</span>
      </div>
      <div style={styles.content}>
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
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--bg-surface0)' },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer', padding: 4 },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase' as const, letterSpacing: 1, display: 'block', marginBottom: 12 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--bg-surface0)' },
  label: { fontSize: 15, color: 'var(--text-primary)' },
  value: { fontSize: 14, color: 'var(--text-muted)' },
};
