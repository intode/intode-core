// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const listSshKeys = vi.fn(async () => ({ keys: [{ id: 'k1', name: 'laptop', type: 'ed25519' }] }));
const connect = vi.fn(async (_o: unknown) => ({ sessionId: 'sess1' }));
const disconnect = vi.fn(async (_o: unknown) => {});
const getPendingHostKey = vi.fn(async () => ({ prompt: null as HostKeyPrompt | null }));
const acceptHostKey = vi.fn(async (_o: unknown) => {});

// The arrows defer the lookups: vi.mock is hoisted above the consts above.
vi.mock('../ssh/index', () => ({
  Ssh: {
    listSshKeys: (...a: unknown[]) => listSshKeys(...(a as [])),
    connect: (...a: unknown[]) => connect(a[0]),
    disconnect: (...a: unknown[]) => disconnect(a[0]),
    getPendingHostKey: () => getPendingHostKey(),
    acceptHostKey: (...a: unknown[]) => acceptHostKey(a[0]),
  },
}));

import { WorkspaceAddScreen } from './WorkspaceAddScreen';
import { setWorkspaceStore } from './WorkspaceManager';
import type { Workspace, WorkspaceStore } from './WorkspaceManager';
import { setSshCapabilities } from '../ssh/capabilities';
import type { HostKeyPrompt } from '../ssh/plugin-api';

const store: WorkspaceStore = {
  getAll: async () => [],
  create: async () => ({} as Workspace),
  update: async () => {},
  delete: async () => {},
  reorder: async () => {},
  getPassword: async () => 'hunter2',
  savePassword: async () => {},
  getJumpHostPasswords: async () => [],
  saveJumpHostPasswords: async () => {},
};

const keyWorkspace: Workspace = {
  id: 'w1', name: 'box', host: 'h', port: 22, username: 'u', authType: 'key',
  keyId: 'k1', defaultPath: '~', lastConnectedAt: null, createdAt: 0, updatedAt: 0, sortOrder: 0,
};

beforeEach(() => {
  listSshKeys.mockClear();
  connect.mockReset();
  connect.mockResolvedValue({ sessionId: 'sess1' });
  disconnect.mockReset();
  disconnect.mockResolvedValue(undefined);
  getPendingHostKey.mockReset();
  getPendingHostKey.mockResolvedValue({ prompt: null });
  acceptHostKey.mockReset();
  acceptHostKey.mockResolvedValue(undefined);
  setWorkspaceStore(store);
});

afterEach(() => {
  cleanup();
  setSshCapabilities({});
});

const renderAdd = (editWorkspace?: Workspace) =>
  render(<WorkspaceAddScreen onSave={vi.fn()} onCancel={vi.fn()} editWorkspace={editWorkspace} />);

/** "SSH Key" is also the field label, so pick the toggle out by tag. */
const keyToggle = () =>
  screen.queryAllByText('SSH Key').find((el) => el.tagName === 'BUTTON') ?? null;

describe('WorkspaceAddScreen key auth availability', () => {
  it('offers key auth when the runtime can both store keys and use them', () => {
    renderAdd();
    expect(keyToggle()).toBeTruthy();
  });

  it('hides key auth when connect() would ignore the key', () => {
    setSshCapabilities({ keyAuth: false });
    renderAdd();
    expect(keyToggle()).toBeNull();
  });

  it('hides key auth, and does not ask for a key list, without key management', () => {
    setSshCapabilities({ keyManagement: false, keyAuth: false });
    renderAdd();
    expect(keyToggle()).toBeNull();
    expect(listSshKeys).not.toHaveBeenCalled();
  });

  it('keeps a saved key workspace readable, and still saveable, where key auth does not work', async () => {
    setSshCapabilities({ keyManagement: false, keyAuth: false });
    renderAdd(keyWorkspace);

    // The option stays visible because this record is on it — hiding it would
    // make the user's own setting invisible.
    expect(keyToggle()).toBeTruthy();
    expect(screen.getByText('Key authentication is not available on this platform')).toBeTruthy();
    // No key list, so the stored id stands in for the name.
    expect(screen.getByText('k1')).toBeTruthy();
    // Generate/Import belong to the key manager, which is gone too.
    expect(screen.queryByText('+ Generate')).toBeNull();
    expect(screen.queryByText('+ Import')).toBeNull();

    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false);
    // Testing it could only fail, and the failure would come from the bridge.
    await waitFor(() =>
      expect((screen.getByText('Test Connection') as HTMLButtonElement).disabled).toBe(true),
    );
  });

  it('names no operating system anywhere on the screen', () => {
    setSshCapabilities({ keyManagement: false, keyAuth: false });
    const { container } = renderAdd(keyWorkspace);
    expect(container.textContent ?? '').not.toMatch(/\bios\b|android|iphone/i);
  });

  // iOS capitalises the first letter of a plain text field, so a typed "reviewer"
  // arrives as "Reviewer". Usernames, hosts and paths are case-sensitive, and the
  // only symptom is "Permission denied" — nothing on screen says why. Guard it.
  it('never auto-capitalises the case-sensitive fields', () => {
    setSshCapabilities({ keyManagement: true, keyAuth: true });
    const { container } = renderAdd();
    const byLabel = (label: string): HTMLInputElement => {
      const field = [...container.querySelectorAll('label')].find((l) => l.textContent === label);
      if (!field) throw new Error(`no field labelled ${label}`);
      const input = field.parentElement?.querySelector('input');
      if (!input) throw new Error(`no input under ${label}`);
      return input as HTMLInputElement;
    };

    for (const label of ['Host', 'Username', 'Port', 'Default Path']) {
      expect(byLabel(label).getAttribute('autocapitalize')).toBe('none');
    }
    // The display name is prose, so it keeps the platform default.
    expect(byLabel('Name').getAttribute('autocapitalize')).toBe('sentences');
  });
});

const unknownKey: HostKeyPrompt = {
  host: 'bastion.example.com', port: 2222,
  fingerprint: 'SHA256:AAAAnewkey', keyType: 'ssh-ed25519',
};
const changedKey: HostKeyPrompt = { ...unknownKey, knownFingerprint: 'SHA256:BBBBoldkey' };

/** Enough of the form for Test Connection to light up. */
function fillPasswordForm() {
  fireEvent.change(screen.getByPlaceholderText('192.168.1.10'), { target: { value: '10.0.0.5' } });
  fireEvent.change(screen.getByPlaceholderText('user'), { target: { value: 'root' } });
  fireEvent.change(screen.getByPlaceholderText('\u2022'.repeat(8)), { target: { value: 'hunter2' } });
}

const clickTest = () => fireEvent.click(screen.getByText('Test Connection'));

describe('WorkspaceAddScreen host key prompt on Test Connection', () => {
  it('offers the unknown host key, then succeeds and drops the session once trusted', async () => {
    // Adding a workspace is exactly the moment the server is not trusted yet, so the
    // first attempt is refused and the second — after trusting — goes through.
    connect.mockRejectedValueOnce(new Error('reject HostKey'));
    getPendingHostKey.mockResolvedValueOnce({ prompt: unknownKey });

    renderAdd();
    fillPasswordForm();
    clickTest();

    expect(await screen.findByText('Unknown Host Key')).toBeTruthy();
    expect(screen.getByText(unknownKey.fingerprint)).toBeTruthy();
    // Nothing is trusted by showing the prompt.
    expect(acceptHostKey).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Trust'));

    expect(await screen.findByText(/Connection successful/)).toBeTruthy();
    // The fingerprint is trusted for the hop that refused it, not for the host typed
    // into the form — a jump chain can stop somewhere this screen never named.
    expect(acceptHostKey).toHaveBeenCalledWith({
      host: 'bastion.example.com', port: 2222, fingerprint: 'SHA256:AAAAnewkey',
      // Recorded alongside the trust so the Known Hosts screen can name the algorithm.
      keyType: 'ssh-ed25519',
    });
    expect(connect).toHaveBeenCalledTimes(2);
    // A test that leaves a session behind is a leak, trusted key or not.
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledWith({ sessionId: 'sess1' });
  });

  it('marks a changed key as a warning, not another unknown host', async () => {
    connect.mockRejectedValueOnce(new Error('reject HostKey'));
    getPendingHostKey.mockResolvedValueOnce({ prompt: changedKey });

    renderAdd();
    fillPasswordForm();
    clickTest();

    expect(await screen.findByText('Host Key Changed')).toBeTruthy();
    // Both fingerprints, so the user can see what changed.
    expect(screen.getByText(changedKey.fingerprint)).toBeTruthy();
    expect(screen.getByText('SHA256:BBBBoldkey')).toBeTruthy();
    // The confirm button is not the one an unknown host gets: no accepting a possible
    // interception with the same tap that accepts a first-time server.
    expect(screen.queryByText('Trust')).toBeNull();
    expect(screen.getByText('Trust New Key')).toBeTruthy();
    expect(acceptHostKey).not.toHaveBeenCalled();
  });

  it('leaves the failure alone where the platform verifies no host keys', async () => {
    // The web bridge answers { prompt: null }; nothing about that path may change.
    connect.mockRejectedValueOnce(new Error('Auth fail'));

    renderAdd();
    fillPasswordForm();
    clickTest();

    expect(await screen.findByText(/Auth fail/)).toBeTruthy();
    expect(screen.queryByText('Unknown Host Key')).toBeNull();
  });

  it('leaves the failure alone where the plugin has no getPendingHostKey at all', async () => {
    connect.mockRejectedValueOnce(new Error('Auth fail'));
    getPendingHostKey.mockRejectedValueOnce(new Error('not implemented'));

    renderAdd();
    fillPasswordForm();
    clickTest();

    expect(await screen.findByText(/Auth fail/)).toBeTruthy();
    expect(screen.queryByText('Unknown Host Key')).toBeNull();
  });

  it('reports a rejected key as a failed test and trusts nothing', async () => {
    connect.mockRejectedValueOnce(new Error('reject HostKey'));
    getPendingHostKey.mockResolvedValueOnce({ prompt: unknownKey });

    renderAdd();
    fillPasswordForm();
    clickTest();

    expect(await screen.findByText('Unknown Host Key')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => expect(screen.getByText(/Host key not trusted/)).toBeTruthy());
    expect(acceptHostKey).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
