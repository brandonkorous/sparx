import { describe, expect, it } from 'vitest';

import {
  accountCoverLine,
  coverageChoices,
  coverageLabel,
  exemptionStanding,
  reasonLabel,
  removalConsequence,
  standingBadge,
  validityText,
} from './tax-exemption-words';

/**
 * A TAX EXEMPTION CERTIFICATE, SAID THE WAY THE OWNER SAYS IT (issue 075).
 *
 * O'Malley Ranch & Hay Co. holds an agricultural certificate for Utah;
 * Høgberg Diesel & Performance holds a resale certificate for Idaho. The owner
 * reads these rows to answer one question: is this business covered today, and
 * where? Every sentence here is checked against what checkout actually does.
 */

const NOW = new Date('2026-10-02T18:00:00.000Z');

const RANCH_AG_UT = {
  id: 'cert-1',
  jurisdiction: 'US-UT',
  reason: 'agricultural',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: null,
};

describe('the words on a certificate', () => {
  it('names the kind and the place in plain words, never as codes', () => {
    expect(reasonLabel('agricultural')).toBe('Agricultural');
    expect(reasonLabel('resale')).toBe('Resale');
    expect(coverageLabel('US-UT')).toBe('Utah');
    expect(coverageLabel('US-ID')).toBe('Idaho');
    expect(coverageLabel('US')).toBe('Everywhere in the United States');
  });

  it('says when an open-ended certificate has no end date', () => {
    expect(validityText(RANCH_AG_UT)).toMatch(/^From .*2026 · No end date$/);
  });

  it('offers the whole country first, then each state by name', () => {
    const choices = coverageChoices(['US'], () => [{ value: 'US-UT', label: 'Utah' }]);
    expect(choices).toEqual([
      { value: 'US', label: 'Everywhere in the United States' },
      { value: 'US-UT', label: 'Utah' },
    ]);
  });
});

describe('whether it covers today, by the rule checkout uses', () => {
  it('is in force between its start and its end', () => {
    expect(exemptionStanding(RANCH_AG_UT, NOW)).toEqual({ kind: 'in_force' });
    expect(standingBadge({ kind: 'in_force' })).toEqual({ tone: 'success', label: 'In force' });
  });

  it('has not started before its start day', () => {
    const later = { ...RANCH_AG_UT, validFrom: '2026-11-01T00:00:00.000Z' };
    const standing = exemptionStanding(later, NOW);
    expect(standing.kind).toBe('starts');
    expect(standingBadge(standing).tone).toBe('info');
    expect(standingBadge(standing).label).toMatch(/^Starts /);
  });

  it('covers all of its last day, and has expired the day after', () => {
    const lastDay = { ...RANCH_AG_UT, validTo: '2026-10-02T23:59:59.000Z' };
    expect(exemptionStanding(lastDay, NOW).kind).toBe('in_force');
    const ended = { ...RANCH_AG_UT, validTo: '2026-10-01T23:59:59.000Z' };
    const standing = exemptionStanding(ended, NOW);
    expect(standing.kind).toBe('expired');
    expect(standingBadge(standing).tone).toBe('warning');
  });
});

describe('what removing one changes at checkout', () => {
  it('warns that tax comes back where nothing else covers', () => {
    expect(removalConsequence(RANCH_AG_UT, [], "O'Malley Ranch & Hay Co.", NOW)).toBe(
      "Orders from O'Malley Ranch & Hay Co. delivered to Utah stop being exempt: they pay sales tax wherever you collect it."
    );
  });

  it('does not threaten a change when another certificate still covers the place', () => {
    const nationwide = { ...RANCH_AG_UT, id: 'cert-2', jurisdiction: 'US' };
    expect(removalConsequence(RANCH_AG_UT, [nationwide], 'Dale Pruitt', NOW)).toMatch(
      /^Another certificate still covers orders delivered to Utah, so nothing changes/
    );
  });

  it('says nothing changes when the certificate was not covering anything', () => {
    const ended = { ...RANCH_AG_UT, validTo: '2025-12-31T23:59:59.000Z' };
    expect(removalConsequence(ended, [], 'Dale Pruitt', NOW)).toMatch(/nothing changes/);
  });
});

describe('the line on a customer whose account holds the certificate', () => {
  it('names the account and the place, so the owner does not file it twice', () => {
    expect(
      accountCoverLine(
        { accountName: "O'Malley Ranch & Hay Co.", exemptions: [RANCH_AG_UT] },
        'wholesale account',
        false,
        NOW
      )
    ).toBe(
      "O'Malley Ranch & Hay Co., the wholesale account they buy for, holds a certificate that covers them (Utah), so you do not need to add one here as well."
    );
  });

  it('says so plainly when the account certificate is not covering them today', () => {
    const ended = { ...RANCH_AG_UT, validTo: '2025-12-31T23:59:59.000Z' };
    expect(
      accountCoverLine(
        { accountName: 'Høgberg Diesel & Performance', exemptions: [ended] },
        'wholesale account',
        false,
        NOW
      )
    ).toBe(
      'Høgberg Diesel & Performance, the wholesale account they buy for, has a certificate on file, but it does not cover them today.'
    );
  });

  it('mentions the account as well, without waving off their own, when they have one', () => {
    expect(
      accountCoverLine(
        { accountName: "O'Malley Ranch & Hay Co.", exemptions: [RANCH_AG_UT] },
        'wholesale account',
        true,
        NOW
      )
    ).toBe(
      "O'Malley Ranch & Hay Co., the wholesale account they buy for, also holds a certificate that covers them (Utah)."
    );
  });

  it('says nothing when there is no account, or it holds no certificate', () => {
    expect(accountCoverLine(null, 'wholesale account', false, NOW)).toBeNull();
    expect(
      accountCoverLine({ accountName: 'Høgberg', exemptions: [] }, 'wholesale account', false, NOW)
    ).toBeNull();
  });
});
