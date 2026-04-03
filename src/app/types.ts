import type { Workspace } from '../workspace/WorkspaceManager';

export interface ConnectedWorkspace {
  wsId: string;
  workspace: Workspace;
  sessionId: string;
  sftpId: string | null;
  sftpError: string | null;
}
