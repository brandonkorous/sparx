// Which location online orders ship from (issue 929). Postage, labels and the
// Locations screen all read this answer, so it has to be the same one every
// time, whatever order the database returns the rows in.

import { describe, expect, it } from 'vitest';
import { channelDefaultId, type ChannelCandidate } from './channel-default';

function place(id: string, day: number, extra: Partial<ChannelCandidate> = {}): ChannelCandidate {
  return {
    id,
    defaultForChannel: [],
    createdAt: new Date(Date.UTC(2026, 7, day)),
    type: 'owned',
    isSystem: false,
    metadata: {},
    ...extra,
  };
}

// Juniper Row: her main location, the sample pack's Ohio one, and the
// platform's in-transit holding place.
const main = place('main', 23);
const sample = place('fc', 23, { metadata: { sample: true } });
const transit = place('transit', 1, { isSystem: true, type: 'virtual' });

describe('the location online orders ship from', () => {
  it('is the one she named for the channel', () => {
    const named = place('studio', 30, { defaultForChannel: ['storefront'] });
    expect(channelDefaultId([main, sample, named], 'storefront')).toBe('studio');
  });

  it('is her own oldest place when none is named, never the sample pack’s', () => {
    expect(channelDefaultId([sample, transit, place('main', 24)], 'storefront')).toBe('main');
  });

  it('does not depend on the order the rows arrive in', () => {
    const rows = [transit, sample, main, place('back', 25)];
    const answers = new Set(
      [rows, [...rows].reverse(), [rows[2]!, rows[0]!, rows[3]!, rows[1]!]].map((order) =>
        channelDefaultId(order, 'storefront')
      )
    );
    expect([...answers]).toEqual(['main']);
  });

  it('skips a supplier’s place and a place on paper only while a real one exists', () => {
    const supplier = place('supplier', 2, { type: 'dropship' });
    const paper = place('paper', 3, { type: 'virtual' });
    expect(channelDefaultId([supplier, paper, main], 'storefront')).toBe('main');
  });

  it('still answers when the sample location is the only one left', () => {
    expect(channelDefaultId([transit, sample], 'storefront')).toBe('fc');
  });

  it('is nothing when no location is in use', () => {
    expect(channelDefaultId([], 'storefront')).toBeNull();
  });
});
