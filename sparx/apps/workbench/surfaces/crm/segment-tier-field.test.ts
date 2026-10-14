import { describe, expect, it } from 'vitest';
import { fieldMeta, fieldOptionsIncluding, OFFERED_FIELDS } from './segment-rules';

/**
 * A segment on price tier picks the tier from a list, by id (sparx persona
 * issue 149). It was a text box for the tier's name: `fleet` matched nobody,
 * and renaming the tier emptied the segment.
 */
describe('the price tier condition', () => {
  it('is offered as a pick from the tiers, not typed', () => {
    expect(OFFERED_FIELDS).toContain('b2bAccount.pricingTierId');
    expect(fieldMeta('b2bAccount.pricingTierId').kind).toBe('tier');
    expect(fieldMeta('b2bAccount.pricingTierId').label).toBe('Price tier');
  });

  it('no longer offers the typed name, but still shows a rule saved on it', () => {
    expect(OFFERED_FIELDS).not.toContain('b2bAccount.pricingTier');
    const options = fieldOptionsIncluding('b2bAccount.pricingTier').map((o) => o.value);
    expect(options).toContain('b2bAccount.pricingTier');
    expect(fieldMeta('b2bAccount.pricingTier').label).not.toBe('Price tier');
  });
});
