import { getPolicy } from '../policies/provider';
import { checkLimit } from '../policies/provider';

export interface WorkspaceJumpHost {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  keyId?: string;
}

export interface PortForwardConfig {
  id: string;
  type: 'local' | 'remote';
  bindPort: number;
  targetHost: string;
  targetPort: number;
}

export interface Workspace {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  keyId?: string;
  defaultPath: string;
  jumpHosts?: WorkspaceJumpHost[];
  portForwards?: PortForwardConfig[];
  lastConnectedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Manual display position (ascending). Absent on pre-migration data; the store backfills it on first load. */
  sortOrder?: number;
}

export type CreateWorkspaceData = Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'lastConnectedAt' | 'sortOrder'>;

export interface WorkspaceStore {
  getAll(): Promise<Workspace[]>;
  create(data: CreateWorkspaceData): Promise<Workspace>;
  update(id: string, data: Partial<Workspace>): Promise<void>;
  delete(id: string): Promise<void>;
  /** Persist a user-defined order. orderedIds holds every workspace id in display order. */
  reorder(orderedIds: string[]): Promise<void>;
  getPassword(id: string): Promise<string | null>;
  savePassword(id: string, password: string): Promise<void>;
  getJumpHostPasswords(id: string): Promise<string[]>;
  saveJumpHostPasswords(id: string, passwords: string[]): Promise<void>;
}

let store: WorkspaceStore | null = null;

export function setWorkspaceStore(s: WorkspaceStore): void {
  store = s;
}

export function getWorkspaceStore(): WorkspaceStore {
  if (!store) throw new Error('WorkspaceStore not initialized. Call setWorkspaceStore() first.');
  return store;
}

export async function createWorkspace(data: CreateWorkspaceData, password?: string, jumpHostPasswords?: string[]): Promise<Workspace | null> {
  const s = getWorkspaceStore();
  const all = await s.getAll();
  const { maxProjects } = getPolicy();
  if (!(await checkLimit('projects', all.length, maxProjects))) return null;

  const workspace = await s.create(data);
  if (password) {
    await s.savePassword(workspace.id, password);
  }
  if (jumpHostPasswords && jumpHostPasswords.length > 0) {
    await s.saveJumpHostPasswords(workspace.id, jumpHostPasswords);
  }
  return workspace;
}
