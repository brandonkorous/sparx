import { describe, expect, it } from 'vitest';

import { AccountPatchBody } from './accounts';

// Every term the add-account screen offers has to survive an edit of the same
// account (sparx persona issue 076): O'Malley Ranch on 15 days to pay could be
// created and then never saved again.
describe('editing a wholesale account on any agreed terms', () => {
  it.each(['prepay', 'net7', 'net14', 'net15', 'net30', 'net45', 'net60', 'net90'])(
    'accepts %s',
    (terms) => {
      expect(AccountPatchBody.parse({ paymentTerms: terms }).paymentTerms).toBe(terms);
    }
  );

  it('still refuses a typo', () => {
    expect(() => AccountPatchBody.parse({ paymentTerms: 'net 30 days' })).toThrow();
  });
});
