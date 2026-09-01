// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { Toaster } from './Toaster';
import { notify, dismissNotice, getNotices } from './notice';
import { describeFailure } from '../ssh/unavailable';

function clear(): void {
  for (const n of getNotices()) dismissNotice(n.id);
}

describe('Toaster', () => {
  beforeEach(clear);
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing when there is nothing to say', () => {
    const { container } = render(<Toaster />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a failure without leaking the bridge wording', () => {
    render(<Toaster />);
    const { title, detail } = describeFailure(
      'Rename',
      new Error('Ssh.sftpRename() is not implemented on ios'),
    );
    act(() => { notify('error', title, detail); });

    expect(screen.getByText('Rename is not available on this platform')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Ssh\.|is not implemented on/);
  });

  it('keeps a server message, which is the part worth reading', () => {
    render(<Toaster />);
    act(() => { notify('error', 'Delete failed', 'Permission denied'); });
    expect(screen.getByText('Delete failed')).toBeTruthy();
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('dismisses on tap', () => {
    render(<Toaster />);
    act(() => { notify('error', 'New folder failed', 'File exists'); });
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('New folder failed')).toBeNull();
  });

  it('lets an error sit but fades an informational notice', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => { notify('error', 'Rename failed'); });
    act(() => { notify('info', 'Copied'); });

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('Copied')).toBeNull();
    expect(screen.getByText('Rename failed')).toBeTruthy();
  });
});
