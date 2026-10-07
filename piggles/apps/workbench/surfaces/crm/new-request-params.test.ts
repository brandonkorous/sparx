// A request added from a company page names who asked when only one person
// works there (sparx persona issue 112).

import { describe, expect, it } from 'vitest';

import { newRequestParams } from './companies-data';

describe('newRequestParams', () => {
  it('names the only person at the company', () => {
    expect(newRequestParams([{ id: '0d6f2c1e-8a4b-4c3d-9e2f-1a2b3c4d5e6f' }])).toEqual({
      id: 'new',
      customerId: '0d6f2c1e-8a4b-4c3d-9e2f-1a2b3c4d5e6f',
    });
  });

  it('leaves the choice open when several people work there', () => {
    expect(
      newRequestParams([
        { id: '0d6f2c1e-8a4b-4c3d-9e2f-1a2b3c4d5e6f' },
        { id: '1e7a3d2f-9b5c-4d4e-8f3a-2b3c4d5e6f7a' },
      ])
    ).toEqual({ id: 'new' });
  });
});
