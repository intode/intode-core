import { describe, it, expect } from 'vitest';
import { launchResumeWorkspaceId } from './session-hooks';
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
