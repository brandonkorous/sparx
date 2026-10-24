import { afterEach, describe, expect, it, vi } from 'vitest';

import { maskEmails, redact, redactingLogger } from './redacting-logger';

// Better Auth logged "User not found { email: '…' }" on a failed sign-in (trace
// 4d32a5bf). The address must not reach the logs.

describe('redactingLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('masks the email Better Auth logs when a sign-in finds no user', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    redactingLogger.log?.('error', 'User not found', { email: 'jane.doe@example.com' });
    expect(error).toHaveBeenCalledWith('[Better Auth]: User not found', {
      email: 'j***@example.com',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('jane.doe');
  });

  it('masks an email inside the message too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    redactingLogger.log?.('warn', 'Reset for bob@shop.co failed');
    expect(warn).toHaveBeenCalledWith('[Better Auth]: Reset for b***@shop.co failed');
  });

  it('logs warn and up only', () => {
    expect(redactingLogger.level).toBe('warn');
  });
});

describe('redact', () => {
  it('masks nested values and leaves the rest alone', () => {
    expect(redact({ user: { email: 'a@b.io', id: 7 }, list: ['c@d.io'] })).toEqual({
      user: { email: 'a***@b.io', id: 7 },
      list: ['c***@d.io'],
    });
    expect(maskEmails('no address here')).toBe('no address here');
  });
});
