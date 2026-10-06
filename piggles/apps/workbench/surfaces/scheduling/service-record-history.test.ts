// Putting a visit on a trade account and its vehicle is written to the booking's
// history (sparx persona issue 086). The history must say it in words: a field
// it has no name for prints the raw column name, "Changed companyId".

import { describe, expect, it } from 'vitest';

import { describeTimelineEntry } from './bookings-data';

function updated(changes: Record<string, unknown>) {
  return describeTimelineEntry({
    id: 'e1',
    action: 'booking.updated',
    actorId: null,
    actorType: 'user',
    diff: { changes },
    createdAt: '2026-10-02T12:00:00.000Z',
  });
}

describe('the history names what a fleet edit changed', () => {
  it('names the trade account', () => {
    expect(updated({ companyId: { from: null, to: 'c1' } }).detail).toBe(
      'Changed the trade account'
    );
  });

  it('names the account and the vehicle together', () => {
    expect(
      updated({ companyId: { from: null, to: 'c1' }, assetRef: { from: null, to: {} } }).detail
    ).toBe('Changed the trade account and the vehicle');
  });
});
