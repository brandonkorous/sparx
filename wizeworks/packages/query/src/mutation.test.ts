import { describe, expect, it } from 'vitest';
import { useMutation as tanstackUseMutation } from '@tanstack/react-query';

import * as pkg from './index';
import { callerHandledError, useMutation } from './mutation';

describe('the package shadows TanStack useMutation', () => {
  // `index.ts` does `export * from '@tanstack/react-query'` AND exports its own
  // `useMutation` after it. The explicit export is meant to win. If it ever
  // stops winning, every call site keeps compiling and the failed-write reporter
  // silently goes back to announcing failures the call site already announced —
  // exactly the shape of bug this file exists to fix (issue 304).
  it('hands callers ours, not TanStack’s', () => {
    expect(pkg.useMutation).toBe(useMutation);
    expect(pkg.useMutation).not.toBe(tanstackUseMutation);
  });

  it('still re-exports the rest of TanStack', () => {
    expect(typeof pkg.useQuery).toBe('function');
    expect(typeof pkg.QueryClient).toBe('function');
  });
});

describe('callerHandledError', () => {
  it('is false for meta that never went through the hook', () => {
    expect(callerHandledError(undefined)).toBe(false);
    expect(callerHandledError(null)).toBe(false);
    expect(callerHandledError({})).toBe(false);
    expect(callerHandledError({ writing: 'the order' })).toBe(false);
  });

  // A reporter that cannot tell must SPEAK rather than stay silent — a duplicate
  // toast is annoying, a silent failed write is the thing the net exists for.
  it('is false for a malformed flag rather than assuming somebody spoke', () => {
    expect(callerHandledError({ __sparxCallerHandlers: 'yes' })).toBe(false);
    expect(callerHandledError({ __sparxCallerHandlers: null })).toBe(false);
    expect(callerHandledError({ __sparxCallerHandlers: {} })).toBe(false);
    expect(callerHandledError({ __sparxCallerHandlers: { onError: 'true' } })).toBe(false);
  });

  it('reads the flag the hook leaves behind', () => {
    expect(callerHandledError({ __sparxCallerHandlers: { onError: true } })).toBe(true);
    expect(callerHandledError({ __sparxCallerHandlers: { onError: false } })).toBe(false);
  });

  it('sees the flag flip, because meta carries the object by reference', () => {
    const handlers = { onError: false };
    const meta = { __sparxCallerHandlers: handlers };
    expect(callerHandledError(meta)).toBe(false);
    handlers.onError = true;
    expect(callerHandledError(meta)).toBe(true);
  });
});
