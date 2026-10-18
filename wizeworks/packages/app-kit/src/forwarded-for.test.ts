import { describe, expect, it } from 'vitest';
import { forwardedFor } from './forwarded-for';

const from = (init: Record<string, string>) => new Headers(init);

describe('forwardedFor', () => {
  it('passes the whole chain through, untrimmed', () => {
    // api-rest picks the visitor by reading from the right; trimming here to
    // the first entry would hand it the address the client wrote.
    expect(forwardedFor(from({ 'X-Forwarded-For': '6.6.6.6, 9.9.9.9, 104.16.0.5' }))).toEqual({
      'x-forwarded-for': '6.6.6.6, 9.9.9.9, 104.16.0.5',
    });
  });

  it('carries x-real-ip as x-forwarded-for, the only header api-rest reads', () => {
    expect(forwardedFor(from({ 'x-real-ip': '9.9.9.9' }))).toEqual({
      'x-forwarded-for': '9.9.9.9',
    });
  });

  it('prefers the chain when both arrived', () => {
    expect(
      forwardedFor(from({ 'x-forwarded-for': '9.9.9.9, 104.16.0.5', 'x-real-ip': '1.1.1.1' }))
    ).toEqual({ 'x-forwarded-for': '9.9.9.9, 104.16.0.5' });
  });

  it('adds nothing when the request carried no client address', () => {
    expect(forwardedFor(from({ accept: 'text/html' }))).toEqual({});
    expect(forwardedFor(from({ 'x-forwarded-for': '   ' }))).toEqual({});
  });
});
