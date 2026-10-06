// Which terms an order on account is billed on (issue 082).
//
// The rule for WHETHER an order may go on terms at all (account standing, the
// credit limit, and that an order past the limit waits for sign-off rather than
// being refused) moved to `@wizeworks/crm`'s account-order-gate, because an
// accepted quote has to ask the same question (sparx persona issue 085). Its
// tests are in wizeworks/packages/crm/test/unit/account-order-gate.test.ts.

import { describe, expect, it } from 'vitest';
import { billedTerms } from './checkout-service';

// Issue 082: the storefront let the buyer pick Net 15/30/60/90 and sent it.
// The invoice used the account's terms when it had some, so a buyer who picked
// Net 90 was billed on Net 30; with no account terms the buyer's pick won.
describe('billedTerms', () => {
  it('writes the order on the account terms, not the ones the buyer sent', () => {
    // Wasatch Front is on Net 30. Renée asked for Net 90.
    expect(billedTerms('net90', 'net30')).toEqual({ terms: 'net30', refusal: null });
    // Salt Lake County is on Net 45, which the old list could not even show.
    expect(billedTerms('net30', 'net45')).toEqual({ terms: 'net45', refusal: null });
  });

  it('refuses terms the shop never gave', () => {
    const result = billedTerms('net90', null);
    expect(result.terms).toBeNull();
    expect(result.refusal).toMatch(/does not have payment terms set up yet/);
    expect(result.refusal).toMatch(/Pay by card/);
  });

  it('leaves a card order alone', () => {
    expect(billedTerms(undefined, 'net30')).toEqual({ terms: null, refusal: null });
    expect(billedTerms(null, null)).toEqual({ terms: null, refusal: null });
  });
});
