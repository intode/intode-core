// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const listKnownHosts = vi.fn(async () => ({ hosts: [] as KnownHostEntry[] }));
const removeKnownHost = vi.fn(async (_o: unknown) => {});
const clearKnownHosts = vi.fn(async () => ({ removed: 0 }));

// The arrows defer the lookups: vi.mock is hoisted above the consts above.
vi.mock('../index', () => ({
  Ssh: {
    listKnownHosts: () => listKnownHosts(),
    removeKnownHost: (...a: unknown[]) => removeKnownHost(a[0]),
    clearKnownHosts: () => clearKnownHosts(),
  },
}));

import { KnownHostList } from './KnownHostList';
import type { KnownHostEntry } from '../plugin-api';

const dev: KnownHostEntry = {
  host: 'dev.example.com', port: 22,
  fingerprint: 'SHA256:aaaa', keyType: 'ssh-ed25519', trustedAt: 1712200000000,
};
const build: KnownHostEntry = {
  host: 'build.example.com', port: 2222,
  fingerprint: 'SHA256:bbbb', keyType: 'ecdsa-sha2-nistp256', trustedAt: 1710500000000,
};

beforeEach(() => {
  listKnownHosts.mockReset();
  listKnownHosts.mockResolvedValue({ hosts: [dev, build] });
  removeKnownHost.mockReset();
  removeKnownHost.mockResolvedValue(undefined);
  clearKnownHosts.mockReset();
  clearKnownHosts.mockResolvedValue({ removed: 2 });
});

afterEach(cleanup);

describe('KnownHostList', () => {
  it('shows every trusted host with its fingerprint and key type', async () => {
    render(<KnownHostList />);
    await screen.findByText('dev.example.com:22');
    expect(screen.getByText('build.example.com:2222')).toBeTruthy();
    expect(screen.getByText('SHA256:aaaa')).toBeTruthy();
    expect(screen.getByText('ssh-ed25519')).toBeTruthy();
    expect(screen.getAllByText(/^Trusted /).length).toBe(2);
  });

  it('says so when nothing is trusted', async () => {
    listKnownHosts.mockResolvedValue({ hosts: [] });
    render(<KnownHostList />);
    await screen.findByText('No trusted host keys');
    // Nothing to forget, so no destructive button is offered.
    expect(screen.queryByText('Forget All')).toBeNull();
  });

  // Rendering an empty list after a failed query would tell the user they trust nothing.
  it('reports a failed query instead of drawing an empty list', async () => {
    listKnownHosts.mockRejectedValue(new Error('keychain locked'));
    render(<KnownHostList />);
    await screen.findByText(/Could not read trusted host keys/);
    expect(screen.queryByText('No trusted host keys')).toBeNull();
  });

  it('does not forget anything on the first tap', async () => {
    render(<KnownHostList />);
    fireEvent.click(await screen.findByLabelText('Forget dev.example.com:22'));
    expect(removeKnownHost).not.toHaveBeenCalled();
    expect(screen.getByText('Forget this key? This cannot be undone.')).toBeTruthy();
  });

  it('forgets one entry once it is confirmed', async () => {
    render(<KnownHostList />);
    fireEvent.click(await screen.findByLabelText('Forget dev.example.com:22'));
    listKnownHosts.mockResolvedValue({ hosts: [build] });
    fireEvent.click(screen.getByLabelText('Confirm forget dev.example.com:22'));

    await waitFor(() => expect(removeKnownHost).toHaveBeenCalledWith({ host: 'dev.example.com', port: 22 }));
    await waitFor(() => expect(screen.queryByText('dev.example.com:22')).toBeNull());
    expect(screen.getByText('build.example.com:2222')).toBeTruthy();
  });

  it('backs out of a confirmation without touching the store', async () => {
    render(<KnownHostList />);
    fireEvent.click(await screen.findByLabelText('Forget dev.example.com:22'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(removeKnownHost).not.toHaveBeenCalled();
    expect(screen.queryByText('Forget this key? This cannot be undone.')).toBeNull();
    expect(screen.getByText('dev.example.com:22')).toBeTruthy();
  });

  it('confirms the whole list before clearing it, and says how many', async () => {
    render(<KnownHostList />);
    fireEvent.click(await screen.findByText('Forget All'));
    expect(clearKnownHosts).not.toHaveBeenCalled();
    expect(screen.getByText(/Forget all 2 host keys\?/)).toBeTruthy();

    listKnownHosts.mockResolvedValue({ hosts: [] });
    fireEvent.click(screen.getByText('Forget All'));
    await waitFor(() => expect(clearKnownHosts).toHaveBeenCalled());
    await screen.findByText('No trusted host keys');
  });

  it('surfaces a failed removal rather than pretending it worked', async () => {
    removeKnownHost.mockRejectedValue(new Error('keychain is read-only'));
    render(<KnownHostList />);
    fireEvent.click(await screen.findByLabelText('Forget dev.example.com:22'));
    fireEvent.click(screen.getByLabelText('Confirm forget dev.example.com:22'));
    await screen.findByText(/keychain is read-only/);
    expect(screen.getByText('dev.example.com:22')).toBeTruthy();
  });

  it('leaves out the key type row when the entry predates recording it', async () => {
    listKnownHosts.mockResolvedValue({ hosts: [{ host: 'old.example.com', port: 22, fingerprint: 'SHA256:cccc' }] });
    render(<KnownHostList />);
    await screen.findByText('old.example.com:22');
    expect(screen.getByText('Trusted Unknown')).toBeTruthy();
  });
});
