// Regression guard for a production crash: the mirror tagged contacts
// `channel:<acquisition channel>`, but `TagList` enforces `^[a-zA-Z0-9_-]+$` —
// a colon is not in that set. Every tenant with a recorded acquisition channel
// threw on the way into the CRM and never reached the board.
//
// The channel is free-form first-party data (a UTM value, a referrer host), so
// it can never be interpolated into a tag unsanitized.

import { describe, expect, it } from 'vitest';

import { toTag } from './mirror';

// TagList's constraint, restated: `^[a-zA-Z0-9_-]+$`, 1–63 chars (the Postgres
// text[] slot is VARCHAR(63)). Restated rather than imported because this
// package doesn't depend on @sparx/crm-schemas directly and a test isn't worth
// a new dependency edge — if TagList ever loosens, this stays correct, just
// stricter than it needs to be.
const isValidTag = (tag: string | null): boolean =>
  tag !== null && tag.length >= 1 && tag.length <= 63 && /^[a-zA-Z0-9_-]+$/.test(tag);

describe('toTag', () => {
  it('produces a tag TagList accepts', () => {
    expect(isValidTag(toTag('channel', 'organic'))).toBe(true);
    expect(toTag('channel', 'organic')).toBe('channel-organic');
  });

  it('replaces every character the tag pattern rejects', () => {
    for (const raw of [
      'paid:social',
      'google.com',
      'email/newsletter',
      'Referral Traffic',
      'utm_source=x&y',
      'facebook.com/ads',
    ]) {
      const tag = toTag('channel', raw);
      expect(tag, `${raw} produced no tag`).not.toBeNull();
      expect(isValidTag(tag), `${raw} → ${String(tag)}`).toBe(true);
    }
  });

  it('does not exceed the 63-character column limit', () => {
    const tag = toTag('channel', 'x'.repeat(200));
    expect(tag).not.toBeNull();
    expect(tag!.length).toBeLessThanOrEqual(63);
    expect(isValidTag(tag)).toBe(true);
  });

  it('never ends in a trailing hyphen, including after truncation', () => {
    expect(toTag('channel', 'organic---')).toBe('channel-organic');
    expect(toTag('channel', `${'a'.repeat(54)}:::tail`)).not.toMatch(/-$/);
  });

  it('returns null when nothing usable survives, rather than a bare prefix', () => {
    expect(toTag('channel', ':::')).toBeNull();
    expect(toTag('channel', '   ')).toBeNull();
    expect(toTag('channel', '')).toBeNull();
  });
});
