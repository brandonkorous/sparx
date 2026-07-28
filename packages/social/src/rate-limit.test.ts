import { describe, expect, it } from 'vitest';

import { SocialRateLimiter } from './rate-limit.js';

/** A limiter with a clock we control, so pacing is tested without waiting for it. */
function fixed(startMs = 1_000_000) {
  let now = startMs;
  const limiter = new SocialRateLimiter({
    burst: 3,
    intervalMs: 1_000,
    now: () => now,
  });
  // An arrow property, not a method shorthand: these are destructured out of the
  // returned object, and a shorthand method pulled off its object is an unbound `this`.
  return {
    limiter,
    advance: (ms: number): void => {
      now += ms;
    },
  };
}

describe('SocialRateLimiter', () => {
  it('lets a burst straight through', () => {
    const { limiter } = fixed();
    expect(limiter.take('conn')).toBe(0);
    expect(limiter.take('conn')).toBe(0);
    expect(limiter.take('conn')).toBe(0);
  });

  it('paces once the burst is spent', () => {
    const { limiter } = fixed();
    limiter.take('conn');
    limiter.take('conn');
    limiter.take('conn');
    expect(limiter.take('conn')).toBe(1_000);
  });

  it('refills over time', () => {
    const { limiter, advance } = fixed();
    limiter.take('conn');
    limiter.take('conn');
    limiter.take('conn');
    advance(1_000);
    expect(limiter.take('conn')).toBe(0);
  });

  it('keeps connections independent — one tenant cannot pace another', () => {
    const { limiter } = fixed();
    limiter.take('a');
    limiter.take('a');
    limiter.take('a');
    expect(limiter.take('a')).toBeGreaterThan(0);
    expect(limiter.take('b')).toBe(0);
  });

  describe('when a platform says to back off', () => {
    it('blocks the whole grant for the time it asked for', () => {
      const { limiter } = fixed();
      limiter.backOff('conn', 90);
      expect(limiter.isBlocked('conn')).toBe(true);
      expect(limiter.take('conn')).toBe(90_000);
    });

    it('clears once the time has passed', () => {
      const { limiter, advance } = fixed();
      limiter.backOff('conn', 60);
      advance(60_001);
      expect(limiter.isBlocked('conn')).toBe(false);
      expect(limiter.take('conn')).toBe(0);
    });

    it('does not hand back a full burst the instant a short back-off lifts', () => {
      const { limiter, advance } = fixed();
      limiter.backOff('conn', 1);
      advance(1_001);
      // The back-off drained the bucket, so only the ONE token the elapsed second
      // refilled is available. Three instant retries into a platform that just said
      // "slow down" is how a rate limit becomes a longer ban.
      expect(limiter.take('conn')).toBe(0);
      expect(limiter.take('conn')).toBeGreaterThan(0);
    });

    it('does allow a normal burst again after a LONG back-off', () => {
      const { limiter, advance } = fixed();
      limiter.backOff('conn', 300);
      advance(300_001);
      // Five minutes later the quota has genuinely reset; pacing as if it hadn't would
      // punish the tenant for the platform's own hiccup.
      expect(limiter.take('conn')).toBe(0);
      expect(limiter.take('conn')).toBe(0);
      expect(limiter.take('conn')).toBe(0);
    });

    it('takes the LONGER of two overlapping back-offs', () => {
      const { limiter } = fixed();
      limiter.backOff('conn', 120);
      limiter.backOff('conn', 30);
      expect(limiter.take('conn')).toBe(120_000);
    });

    it('treats a negative or absurd wait sanely', () => {
      const { limiter } = fixed();
      limiter.backOff('conn', -5);
      expect(limiter.isBlocked('conn')).toBe(false);
    });
  });

  it('forgets a connection on reset', () => {
    const { limiter } = fixed();
    limiter.backOff('conn', 300);
    limiter.reset('conn');
    expect(limiter.isBlocked('conn')).toBe(false);
  });
});
