import { describe, expect, it } from 'vitest';
import { taxSilenceNotice } from './tax-notice';

/**
 * "SET UP, BUT CHARGING NOTHING", OVER A SHOP CHARGING TAX IN COLORADO.
 *
 * The gate was right and the sentence was not. It fires when ANY place carries a
 * rate and is not collecting, and the title reported that as "nothing" even with
 * another place switched on and charging. Measured: ten tenants have a tax place
 * with a rate; nine collect nowhere, and the tenth is the only one who has
 * switched anything on.
 */
describe('taxSilenceNotice', () => {
  it('says nothing at all when every place with a rate is collecting', () => {
    expect(taxSilenceNotice(0, 4)).toBeNull();
    expect(taxSilenceNotice(0, 0)).toBeNull();
  });

  it('keeps the urgent sentence when nothing anywhere is charging', () => {
    const notice = taxSilenceNotice(3, 0);
    expect(notice?.title).toBe('Set up, but charging nothing');
    expect(notice?.detail).toContain('Every place starts switched off');
  });

  it('does not say "charging nothing" when something is charging', () => {
    // The whole failure, stated as a rule.
    for (const silent of [1, 2, 3, 9]) {
      for (const collecting of [1, 2, 7]) {
        const notice = taxSilenceNotice(silent, collecting);
        expect(notice).not.toBeNull();
        expect(notice?.title).not.toContain('charging nothing');
        expect(notice?.detail).toContain('tax is reaching your checkout');
      }
    }
  });

  it("counts Juniper Row's places the way her screen shows them", () => {
    // California, New York and Texas have a rate and are off; Colorado is on.
    const notice = taxSilenceNotice(3, 1);
    expect(notice?.title).toBe('3 places set up but switched off');
    expect(notice?.detail).toContain('You are charging tax in 1 place');
    expect(notice?.detail).toContain('3 other places have a rate set and are not collecting');
  });

  it('reads correctly with one of each', () => {
    const notice = taxSilenceNotice(1, 1);
    expect(notice?.title).toBe('1 place set up but switched off');
    expect(notice?.detail).toContain('1 other place has a rate set and is not collecting');
  });
});
