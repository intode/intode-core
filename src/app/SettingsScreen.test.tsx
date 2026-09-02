// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { SettingsScreen } from './SettingsScreen';
import { setSshCapabilities } from '../ssh/capabilities';

const renderSettings = () =>
  render(
    <SettingsScreen
      appVersion="1.1.0"
      buildNumber="148"
      onBack={() => {}}
      debugEnabled={false}
      onDebugToggle={() => {}}
    />,
  );

afterEach(() => {
  cleanup();
  setSshCapabilities({});
});

describe('SettingsScreen SSH Keys entry', () => {
  it('is there when the runtime can manage keys', () => {
    renderSettings();
    expect(screen.getByText('SSH Keys')).toBeTruthy();
  });

  it('is gone when it would open a page whose every button fails', () => {
    setSshCapabilities({ keyManagement: false });
    renderSettings();
    expect(screen.queryByText('SSH Keys')).toBeNull();
    // The rest of Settings is untouched.
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
  });
});

describe('SettingsScreen Known Hosts entry', () => {
  it('is there', () => {
    renderSettings();
    expect(screen.getByText('Known Hosts')).toBeTruthy();
  });

  // Host key trust is written by the connect prompt on every platform that verifies, and
  // this is the only way to undo it. Gating it behind key management would hide the exit
  // from a user whose server was rebuilt.
  it('survives a runtime that cannot manage SSH keys', () => {
    setSshCapabilities({ keyManagement: false });
    renderSettings();
    expect(screen.getByText('Known Hosts')).toBeTruthy();
  });
});
