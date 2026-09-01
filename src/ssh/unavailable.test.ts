import { describe, it, expect } from 'vitest';
import { isUnavailableError, describeFailure, UNAVAILABLE_TEXT } from './unavailable';

describe('isUnavailableError', () => {
  it('matches the runtime wording for a missing bridge method', () => {
    expect(isUnavailableError(new Error('Ssh.sftpRename() is not implemented on ios'))).toBe(true);
    expect(isUnavailableError(new Error('Proxy.start() is not implemented on ios'))).toBe(true);
  });

  it('matches a bare string, which is how batch failures are collected', () => {
    expect(isUnavailableError('report.md: "Ssh.sftpCopy()" is not implemented on ios')).toBe(true);
  });

  it('matches a code without the message', () => {
    expect(isUnavailableError({ code: 'UNIMPLEMENTED' })).toBe(true);
    expect(isUnavailableError({ code: 'unavailable' })).toBe(true);
  });

  it('does not swallow real server errors', () => {
    expect(isUnavailableError(new Error('Permission denied'))).toBe(false);
    expect(isUnavailableError(new Error('No such file or directory'))).toBe(false);
    expect(isUnavailableError({ code: 'EACCES' })).toBe(false);
  });

  it('is safe on nothing', () => {
    expect(isUnavailableError(null)).toBe(false);
    expect(isUnavailableError(undefined)).toBe(false);
  });
});

describe('describeFailure', () => {
  it('never leaks the bridge wording when the call is unimplemented', () => {
    const { title, detail } = describeFailure('Rename', new Error('Ssh.sftpRename() is not implemented on ios'));
    expect(title).toBe('Rename is not available on this platform');
    expect(detail).toBeUndefined();
    expect(title).not.toMatch(/Ssh\.|\(\)|ios/);
  });

  it('keeps a server message, which is the actionable half', () => {
    const { title, detail } = describeFailure('Delete', new Error('Permission denied'));
    expect(title).toBe('Delete failed');
    expect(detail).toBe('Permission denied');
  });

  it('names no operating system in the neutral text', () => {
    expect(UNAVAILABLE_TEXT).not.toMatch(/ios|android|iphone/i);
  });
});
