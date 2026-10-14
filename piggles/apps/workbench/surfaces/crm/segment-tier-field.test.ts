import { describe, expect, it } from 'vitest';
import { fieldMeta, fieldOptionsIncluding, OFFERED_FIELDS } from './segment-fields';

/**
 * A segment on a wholesale group picks the group from a list, by id (sparx
 * persona issue 149). It was a text box for the group's name: a typo matched
 * nobody, and renaming the group emptied the segment.
 */
describe('the wholesale group condition', () => {
  it('is offered as a pick from the groups, not typed', () => {
    expect(OFFERED_FIELDS).toContain('b2bAccount.pricingTierId');
    expect(fieldMeta('b2bAccount.pricingTierId').kind).toBe('tier');
    expect(fieldMeta('b2bAccount.pricingTierId').label).toBe('Wholesale group');
  });

  it('no longer offers the typed name, but still shows a rule saved on it', () => {
    expect(OFFERED_FIELDS).not.toContain('b2bAccount.pricingTier');
    const options = fieldOptionsIncluding('b2bAccount.pricingTier').map((o) => o.value);
    expect(options).toContain('b2bAccount.pricingTier');
    expect(fieldMeta('b2bAccount.pricingTier').label).not.toBe('Wholesale group');
  });
});
