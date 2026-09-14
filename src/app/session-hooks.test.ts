import { describe, it, expect } from 'vitest';
import { launchResumeWorkspaceId, haltedSessionFor } from './session-hooks';
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
