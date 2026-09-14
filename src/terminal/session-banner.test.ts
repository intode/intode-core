import { describe, it, expect } from 'vitest';
import { sessionDownReason, sessionBannerTitle } from './session-banner';

describe('sessionDownReason', () => {
  it('clears the banner when the session is connected', () => {
    expect(sessionDownReason('connected', 'disconnected')).toBeNull();
  });

  it('marks a dead or failed session as disconnected', () => {
    expect(sessionDownReason('disconnected', null)).toBe('disconnected');
    expect(sessionDownReason('error', null)).toBe('disconnected');
  });

  it('marks a session the host paused in the background as suspended', () => {
    expect(sessionDownReason('suspended', null)).toBe('suspended');
  });

  it('leaves the banner as it was for in-between states', () => {
    expect(sessionDownReason('connecting', 'suspended')).toBe('suspended');
    expect(sessionDownReason('reconnecting', null)).toBeNull();
  });
});

describe('sessionBannerTitle', () => {
  it('says the session was paused, not that it failed', () => {
    expect(sessionBannerTitle('suspended', false)).toBe('Paused to save battery — Tap to reconnect');
  });

  it('keeps the disconnected wording for a dead session', () => {
    expect(sessionBannerTitle('disconnected', false)).toBe('Disconnected — Tap to reconnect');
  });

  it('shows progress while reconnecting either way', () => {
    expect(sessionBannerTitle('suspended', true)).toBe('Reconnecting…');
    expect(sessionBannerTitle('disconnected', true)).toBe('Reconnecting…');
  });
});
