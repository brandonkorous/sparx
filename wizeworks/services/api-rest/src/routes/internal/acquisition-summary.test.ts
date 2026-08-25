// The acquisition aggregation (docs/80 §10).
//
// Worth testing because two doors now serve these numbers — the operator console
// and the shared-token CSV — and the whole reason the grouping was pulled into
// its own module is that they must never disagree. A regression here is not a
// broken page; it is two surfaces confidently reporting different totals for the
// same week.
//
// The case that matters most is the one about ABSENCE: a signup nobody measured
// must never be counted as a channel, a source, or a campaign. Get that wrong and
// the report reads as though everybody arrived by typing the URL in.

import { describe, expect, it } from 'vitest';

import { summarizeAcquisition, UNATTRIBUTED, type AcquisitionRow } from './acquisition-summary.js';

const NOW = new Date('2026-09-15T12:00:00.000Z');

function row(over: Partial<AcquisitionRow> = {}): AcquisitionRow {
  return {
    acquisitionChannel: 'referral',
    acquisitionSource: 'partner-wwe',
    acquisitionCampaign: 'wwe-netflix-2026-09',
    acquiredAt: new Date('2026-09-10T00:00:00.000Z'),
    status: 'active',
    stripeCustomerId: null,
    createdAt: new Date('2026-09-10T00:00:00.000Z'),
    ...over,
  };
}

const NO_WINDOW = { since: null, until: null };

describe('summarizeAcquisition', () => {
  it('counts every row in the totals, attributed or not', () => {
    const s = summarizeAcquisition(
      [
        row(),
        row(),
        row({ acquisitionChannel: null, acquisitionSource: null, acquisitionCampaign: null }),
      ],
      NO_WINDOW,
      NOW
    );
    expect(s.totals.tenants).toBe(3);
    expect(s.totals.attributed).toBe(2);
    expect(s.totals.unattributed).toBe(1);
  });

  it('keeps un-attributed signups OUT of the source and campaign breakdowns', () => {
    // The load-bearing case. A tenant with no campaign is not a member of a
    // campaign called nothing — bucketing it under "(unknown)" would put the
    // largest bar in the campaign chart on a row that means "no data".
    const s = summarizeAcquisition(
      [
        row(),
        row({ acquisitionChannel: null, acquisitionSource: null, acquisitionCampaign: null }),
      ],
      NO_WINDOW,
      NOW
    );
    expect(s.bySource.map((b) => b.key)).toEqual(['partner-wwe']);
    expect(s.byCampaign.map((b) => b.key)).toEqual(['wwe-netflix-2026-09']);
    expect(s.bySource.every((b) => b.key !== UNATTRIBUTED)).toBe(true);
  });

  it('does show un-attributed signups as their own CHANNEL row, never folded into direct', () => {
    const s = summarizeAcquisition(
      [
        row({ acquisitionChannel: 'direct', acquisitionSource: null, acquisitionCampaign: null }),
        row({ acquisitionChannel: null, acquisitionSource: null, acquisitionCampaign: null }),
      ],
      NO_WINDOW,
      NOW
    );
    const keys = s.byChannel.map((b) => b.key).sort();
    expect(keys).toEqual([UNATTRIBUTED, 'direct']);
    expect(s.byChannel.find((b) => b.key === 'direct')?.tenants).toBe(1);
    expect(s.byChannel.find((b) => b.key === UNATTRIBUTED)?.tenants).toBe(1);
  });

  it('sorts every breakdown by tenant count descending', () => {
    const s = summarizeAcquisition(
      [
        row({ acquisitionCampaign: 'small-2026-09' }),
        row({ acquisitionCampaign: 'big-2026-09' }),
        row({ acquisitionCampaign: 'big-2026-09' }),
        row({ acquisitionCampaign: 'big-2026-09' }),
      ],
      NO_WINDOW,
      NOW
    );
    expect(s.byCampaign.map((b) => b.key)).toEqual(['big-2026-09', 'small-2026-09']);
    expect(s.byCampaign[0]?.tenants).toBe(3);
  });

  it('counts billing and active independently of each other', () => {
    const s = summarizeAcquisition(
      [
        row({ stripeCustomerId: 'cus_1', status: 'active' }),
        row({ stripeCustomerId: null, status: 'active' }),
        row({ stripeCustomerId: 'cus_2', status: 'suspended' }),
      ],
      NO_WINDOW,
      NOW
    );
    const bucket = s.byCampaign[0];
    expect(bucket?.tenants).toBe(3);
    expect(bucket?.withBilling).toBe(2);
    expect(bucket?.active).toBe(2);
    expect(s.totals.withBilling).toBe(2);
  });

  it('names the dominant channel and source on a campaign row', () => {
    const s = summarizeAcquisition(
      [
        row({ acquisitionChannel: 'referral' }),
        row({ acquisitionChannel: 'referral' }),
        row({ acquisitionChannel: 'organic_social', acquisitionSource: 'x' }),
      ],
      NO_WINDOW,
      NOW
    );
    expect(s.byCampaign[0]?.channel).toBe('referral');
    expect(s.byCampaign[0]?.source).toBe('partner-wwe');
  });

  it('reports the first and latest acquisition in a bucket, ignoring null timestamps', () => {
    const s = summarizeAcquisition(
      [
        row({ acquiredAt: new Date('2026-09-02T00:00:00.000Z') }),
        row({ acquiredAt: new Date('2026-09-11T00:00:00.000Z') }),
        row({ acquiredAt: null }),
      ],
      NO_WINDOW,
      NOW
    );
    expect(s.byCampaign[0]?.firstAcquiredAt).toBe('2026-09-02T00:00:00.000Z');
    expect(s.byCampaign[0]?.lastAcquiredAt).toBe('2026-09-11T00:00:00.000Z');
  });

  it('has no rows and honest zero totals when nothing signed up', () => {
    const s = summarizeAcquisition([], NO_WINDOW, NOW);
    expect(s.totals).toEqual({ tenants: 0, attributed: 0, unattributed: 0, withBilling: 0 });
    expect(s.byChannel).toEqual([]);
    expect(s.bySource).toEqual([]);
    expect(s.byCampaign).toEqual([]);
  });

  it('echoes the window and the generation time it was given', () => {
    const since = new Date('2026-08-15T00:00:00.000Z');
    const s = summarizeAcquisition([], { since, until: null }, NOW);
    expect(s.window.since).toBe('2026-08-15T00:00:00.000Z');
    expect(s.window.until).toBeNull();
    expect(s.generatedAt).toBe(NOW.toISOString());
  });
});
