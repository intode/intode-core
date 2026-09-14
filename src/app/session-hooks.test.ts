import { describe, it, expect } from 'vitest';
import { launchResumeWorkspaceId, haltedSessionFor, sessionAfterHalt, autoSaveBlocked } from './session-hooks';
import type { SessionData } from './session-hooks';

const saved: SessionData = { workspaceId: 'ws1', activeTab: 'terminal' };

describe('launchResumeWorkspaceId', () => {
  it('starts at the workspace list when nothing was saved', () => {
    expect(launchResumeWorkspaceId(null)).toBeNull();
  });

  it('reconnects to the last workspace after an automatic save', () => {
    expect(launchResumeWorkspaceId(saved)).toBe('ws1');
  });

  it('does not reconnect after the user halted the session', () => {
    expect(launchResumeWorkspaceId({ ...saved, resumeOnLaunch: false })).toBeNull();
  });
});

describe('haltedSessionFor', () => {
  it('marks the saved session as not resuming when that workspace was disconnected', () => {
    expect(haltedSessionFor(saved, 'ws1')).toEqual({ ...saved, resumeOnLaunch: false });
  });

  it('leaves another workspace’s saved session alone', () => {
    expect(haltedSessionFor(saved, 'ws2')).toBeNull();
  });

  it('has nothing to change when nothing was saved', () => {
    expect(haltedSessionFor(null, 'ws1')).toBeNull();
  });
});

describe('sessionAfterHalt', () => {
  const halted: SessionData = { workspaceId: 'ws1', activeTab: 'files' };

  it('saves the halted workspace with resume off when nothing else is connected', () => {
    expect(sessionAfterHalt(halted, null)).toEqual({ ...halted, resumeOnLaunch: false });
  });

  // Halting from Settings skipped every save while another workspace stayed connected, so an app
  // killed before leaving Settings came back to nothing.
  it('saves the workspace that is still connected so the next launch reconnects it', () => {
    const other: SessionData = { workspaceId: 'ws2', activeTab: 'terminal' };
    expect(sessionAfterHalt(halted, other)).toEqual(other);
  });
});

describe('autoSaveBlocked', () => {
  // Backgrounding the app in the moment between the halt save and React dropping the connection
  // fired an automatic save for the halted workspace, which carries no resumeOnLaunch.
  it('blocks automatic saves for the workspace being halted', () => {
    expect(autoSaveBlocked('ws1', 'ws1')).toBe(true);
  });

  it('allows them for any other workspace, or when nothing is being halted', () => {
    expect(autoSaveBlocked('ws2', 'ws1')).toBe(false);
    expect(autoSaveBlocked('ws1', null)).toBe(false);
  });
});
