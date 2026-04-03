import React, { useState, useEffect, useRef } from 'react';
import { getPolicy } from '../policies/provider';
import { getThemeMode } from '../themes/theme-manager';
import { getSettingsMenuItems, getSettingsPage } from './settings-registry';
import { PageHeader, MenuItem, AppearancePage, SshKeysPage, AboutPage, DeveloperPage, HelpPage } from './settings-pages';
import { s } from './settings-styles';

export interface SettingsScreenProps {
  appVersion: string;
  buildNumber: string;
  onBack: () => void;
  debugEnabled: boolean;
  onDebugToggle: (enabled: boolean) => void;
}

type Page = 'menu' | 'appearance' | 'ssh-keys' | 'about' | 'developer' | string;

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
    const goMenu = () => setPage('menu');
    if (page === 'appearance') return <AppearancePage onBack={goMenu} />;
    if (page === 'ssh-keys') return <SshKeysPage onBack={goMenu} />;
    if (page === 'about') return <AboutPage onBack={goMenu} appVersion={appVersion} buildNumber={buildNumber} />;
    if (page === 'help') return <HelpPage onBack={goMenu} />;
    if (page === 'developer') return <DeveloperPage onBack={goMenu} debugEnabled={debugEnabled} onDebugToggle={onDebugToggle} />;

    const ProPage = getSettingsPage(page);
    if (ProPage) return <ProPage onBack={goMenu} />;
  }

  return (
    <div style={s.page}>
      <PageHeader title="Settings" onBack={onBack} />
      <div style={s.pageContent}>
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
