// The ladder invariants, and the shape of a rate.
//
// Every one of these fails SILENTLY in production if it is not enforced: a
// duplicate key merges two rungs into one number, a second conversion stage
// doubles reported revenue, and a rate defaulted to 0 reports a catastrophe
// where there is only an absence of data. Pure schema tests, no database.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGES,
  FUNNEL_KINDS,
  FunnelStages,
  RecordStageInput,
  pathForSlug,
  stagePath,
} from './schemas.js';

const convert = { key: 'converted', name: 'Converted', kind: 'convert' } as const;

describe('FunnelStages', () => {
  it('accepts a normal ladder', () => {
    expect(
      FunnelStages.safeParse([{ key: 'captured', name: 'Left details', kind: 'capture' }, convert])
        .success
    ).toBe(true);
  });

  it('rejects two stages sharing a key — they would merge in every report', () => {
    const result = FunnelStages.safeParse([
      { key: 'same', name: 'One', kind: 'capture' },
      { key: 'same', name: 'Two', kind: 'engage' },
      convert,
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a ladder with no conversion — the goal would be unmeasurable', () => {
    const result = FunnelStages.safeParse([
      { key: 'captured', name: 'Left details', kind: 'capture' },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects two conversions — attributed value would be counted twice', () => {
    const result = FunnelStages.safeParse([
      { key: 'first', name: 'First', kind: 'convert' },
      { key: 'second', name: 'Second', kind: 'convert' },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a rung below the conversion', () => {
    const result = FunnelStages.safeParse([
      convert,
      { key: 'after', name: 'After', kind: 'engage' },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a key that would not survive a URL or a report grouping', () => {
    expect(
      FunnelStages.safeParse([{ key: 'Has Spaces', name: 'x', kind: 'capture' }, convert]).success
    ).toBe(false);
  });
});

describe('DEFAULT_STAGES', () => {
  // The shipped ladders are stamped into real funnels, so a malformed one ships
  // a broken campaign to every tenant who picks that kind.
  it.each(FUNNEL_KINDS)('the %s ladder satisfies every invariant', (kind) => {
    expect(FunnelStages.safeParse(DEFAULT_STAGES[kind]).success).toBe(true);
  });
});

describe('RecordStageInput', () => {
  const base = { funnelId: '11111111-1111-4111-8111-111111111111', stageKey: 'captured' };

  it('takes a customer', () => {
    expect(
      RecordStageInput.safeParse({ ...base, customerId: '22222222-2222-4222-8222-222222222222' })
        .success
    ).toBe(true);
  });

  it('takes a bare address, for the moment somebody first tells us who they are', () => {
    expect(
      RecordStageInput.safeParse({ ...base, subjectEmail: 'someone@example.com' }).success
    ).toBe(true);
  });

  it('refuses BOTH — that is one person counted twice', () => {
    expect(
      RecordStageInput.safeParse({
        ...base,
        customerId: '22222222-2222-4222-8222-222222222222',
        subjectEmail: 'someone@example.com',
      }).success
    ).toBe(false);
  });

  it('refuses NEITHER — the anonymous row this table must never hold', () => {
    expect(RecordStageInput.safeParse(base).success).toBe(false);
  });
});

describe('a view rung and its page', () => {
  const viewed = { key: 'viewed', name: 'Saw the page', kind: 'view' } as const;

  it('takes a page address', () => {
    expect(FunnelStages.safeParse([{ ...viewed, path: '/pricing' }, convert]).success).toBe(true);
  });

  it('refuses a page address on a rung nobody reaches by visiting one', () => {
    const result = FunnelStages.safeParse([
      { key: 'captured', name: 'Left details', kind: 'capture', path: '/pricing' },
      convert,
    ]);
    expect(result.success).toBe(false);
  });

  it('refuses an address that is not one', () => {
    expect(FunnelStages.safeParse([{ ...viewed, path: 'pricing' }, convert]).success).toBe(false);
  });

  it('falls back to the funnel landing page when the rung names none', () => {
    expect(stagePath(viewed, '/lp/spring')).toBe('/lp/spring');
  });

  it('prefers the rung own address over the landing page', () => {
    expect(stagePath({ ...viewed, path: '/pricing' }, '/lp/spring')).toBe('/pricing');
  });

  it('answers null when there is no page at all, never a countable zero', () => {
    expect(stagePath(viewed, null)).toBeNull();
  });

  it('answers null for every rung below the capture line', () => {
    expect(stagePath({ key: 'c', name: 'C', kind: 'capture' }, '/lp/spring')).toBeNull();
  });
});

describe('pathForSlug', () => {
  // The home page carries three different empty-ish slugs across the seed eras,
  // and all three serve at the root. Getting this wrong counts a landing page
  // funnel at zero forever, with nothing to indicate it.
  it.each([null, undefined, '', '/'])('serves %p at the root', (slug) => {
    expect(pathForSlug(slug)).toBe('/');
  });

  it('serves a named page at its slug', () => {
    expect(pathForSlug('pricing')).toBe('/pricing');
  });

  it('does not double the slash on a slug that already has one', () => {
    expect(pathForSlug('/pricing')).toBe('/pricing');
  });
});
