// Unit coverage for the integrity module's PURE decisions (docs/146 Phase 1).
//
// The DB-bound halves — the reconciliation scan, the oversell rows the reserve
// path writes, the freshness sweep's flag transitions — are exercised against a
// real Postgres in test/integration/integrity.test.ts, because a row lock, a
// rolled-back transaction and a partial unique index cannot be proven with a
// fake. What lives here are the two rules that decide how much stock a customer
// is allowed to see, which is the part most prone to reading plausibly while
// being wrong — and being wrong here costs sales silently.

import { describe, expect, it } from 'vitest';

import { pickBuffer } from '../src/services/channel-buffers';
import { combineStalenessPenalty } from '../src/services/freshness';
import type { StaleSourceRow } from '../src/services/freshness';

describe('pickBuffer (per-channel cushion precedence)', () => {
  const override = { id: 'ov', buffer: 7, variantId: 'v1' };
  const channelDefault = { id: 'cd', buffer: 3, variantId: null };

  it('prefers a level override over the channel default', () => {
    const result = pickBuffer('amazon', [channelDefault, override], 99);
    expect(result).toMatchObject({ buffer: 7, source: 'override', bufferId: 'ov' });
  });

  it('is not order-dependent — the override wins whichever way the rows arrive', () => {
    expect(pickBuffer('amazon', [override, channelDefault], 99).buffer).toBe(7);
    expect(pickBuffer('amazon', [channelDefault, override], 99).buffer).toBe(7);
  });

  it('falls back to the channel default when there is no override', () => {
    const result = pickBuffer('amazon', [channelDefault], 99);
    expect(result).toMatchObject({ buffer: 3, source: 'channel_default', bufferId: 'cd' });
  });

  it('falls back to the level cushion when the channel has no rule at all', () => {
    const result = pickBuffer('storefront', [], 4);
    expect(result).toMatchObject({ buffer: 4, source: 'level', bufferId: null });
  });

  // The bug this exists to prevent: a channel that deliberately declares ZERO —
  // "this one reads stock live and needs no cushion" — must not fall through to
  // the level's number. A truthiness check would do exactly that, and the
  // resulting hidden stock would look like correct behaviour forever.
  it('honours a declared zero rather than falling through to the level cushion', () => {
    const zeroDefault = { id: 'cd0', buffer: 0, variantId: null };
    const result = pickBuffer('storefront', [zeroDefault], 12);
    expect(result).toMatchObject({ buffer: 0, source: 'channel_default' });
  });

  it('honours a zero OVERRIDE over a non-zero channel default', () => {
    const zeroOverride = { id: 'ov0', buffer: 0, variantId: 'v1' };
    const result = pickBuffer('amazon', [channelDefault, zeroOverride], 99);
    expect(result).toMatchObject({ buffer: 0, source: 'override' });
  });
});

describe('combineStalenessPenalty (several late feeds on one level)', () => {
  const source = (over: Partial<StaleSourceRow>): StaleSourceRow => ({
    sourceId: 's',
    name: 'Feed',
    policy: 'warn',
    stalenessBuffer: 0,
    staleSince: null,
    ...over,
  });

  it('is no penalty at all when nothing is late', () => {
    expect(combineStalenessPenalty([])).toEqual({
      extraBuffer: 0,
      pauseChannels: false,
      staleSources: [],
    });
  });

  it('applies no extra cushion for a warn-only source', () => {
    const result = combineStalenessPenalty([source({ policy: 'warn', stalenessBuffer: 9 })]);
    // The buffer is configured but the POLICY does not use it — a warn source
    // that quietly withheld stock would be the opposite of what was asked for.
    expect(result.extraBuffer).toBe(0);
    expect(result.pauseChannels).toBe(false);
    expect(result.staleSources).toHaveLength(1);
  });

  it('takes the LARGEST extra cushion, never the average or the first', () => {
    const result = combineStalenessPenalty([
      source({ sourceId: 'a', policy: 'buffer_up', stalenessBuffer: 2 }),
      source({ sourceId: 'b', policy: 'buffer_up', stalenessBuffer: 8 }),
      source({ sourceId: 'c', policy: 'buffer_up', stalenessBuffer: 5 }),
    ]);
    // 5 would be the average and 2 the first — both leave the level exposed to
    // the source that asked for 8.
    expect(result.extraBuffer).toBe(8);
  });

  it('pauses channels if ANY late source asks for it', () => {
    const result = combineStalenessPenalty([
      source({ sourceId: 'a', policy: 'buffer_up', stalenessBuffer: 3 }),
      source({ sourceId: 'b', policy: 'pause_channel' }),
    ]);
    expect(result.pauseChannels).toBe(true);
    // …and still carries the other source's cushion. The two policies are
    // independent dimensions, not a precedence ladder.
    expect(result.extraBuffer).toBe(3);
  });

  it('reports every late source by name so the cause is nameable', () => {
    const when = new Date('2026-08-01T00:00:00.000Z');
    const result = combineStalenessPenalty([
      source({ sourceId: 'a', name: 'Warehouse ERP', staleSince: when }),
      source({ sourceId: 'b', name: '3PL portal', policy: 'pause_channel' }),
    ]);
    expect(result.staleSources.map((s) => s.name)).toEqual(['Warehouse ERP', '3PL portal']);
    expect(result.staleSources[0]?.staleSince).toBe('2026-08-01T00:00:00.000Z');
    expect(result.staleSources[1]?.staleSince).toBeNull();
  });
});
