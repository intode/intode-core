import { getPolicy } from '../policies/provider';
import { checkLimit } from '../policies/provider';

export interface Workspace {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  keyId?: string;
  defaultPath: string;
  lastConnectedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type CreateWorkspaceData = Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'lastConnectedAt'>;

export interface WorkspaceStore {
  getAll(): Promise<Workspace[]>;
  create(data: CreateWorkspaceData): Promise<Workspace>;
  update(id: string, data: Partial<Workspace>): Promise<void>;
  delete(id: string): Promise<void>;
  getPassword(id: string): Promise<string | null>;
  savePassword(id: string, password: string): Promise<void>;
}

let store: WorkspaceStore | null = null;

export function setWorkspaceStore(s: WorkspaceStore): void {
  store = s;
}

export function getWorkspaceStore(): WorkspaceStore {
  if (!store) throw new Error('WorkspaceStore not initialized. Call setWorkspaceStore() first.');
  return store;
}

export async function createWorkspace(data: CreateWorkspaceData, password?: string): Promise<Workspace | null> {
  const s = getWorkspaceStore();
  const all = await s.getAll();
  const { maxProjects } = getPolicy();
  if (!checkLimit('projects', all.length, maxProjects)) return null;

  const workspace = await s.create(data);
  if (password) {
    await s.savePassword(workspace.id, password);
  }
  return workspace;
}
