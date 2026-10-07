// A customer with no email is the same person on the next import.
//
// MEASURED 2026-10-06 on Gillett: importing the same Shopify customer file a
// second time made a second Desmond Achterberg, the walk-in with a phone and no
// email, while all 29 people with an email were matched (sparx persona issue
// 106).

import { describe, expect, it, vi } from 'vitest';

const people = [
  { id: 'desmond', doNotContact: false, phone: '(801) 555-0193' },
  { id: 'other-desmond', doNotContact: false, phone: '(435) 555-0100' },
];
const findMany = vi.fn((_args: unknown) => Promise.resolve(people));

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, run: (tx: unknown) => unknown) =>
    Promise.resolve(run({ customer: { findMany } })),
}));

const { existingByNameAndPhone, phoneDigits } = await import('./customers');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const DESMOND = { first_name: 'Desmond', last_name: 'Achterberg', phone: '+1 801-555-0193' };

describe('a customer with no email', () => {
  it('reads one phone line however it is written', () => {
    expect(phoneDigits('(801) 555-0193')).toBe('8015550193');
    expect(phoneDigits('+18015550193')).toBe('8015550193');
    expect(phoneDigits('ext 12')).toBeNull();
  });

  it('is matched by name and phone', async () => {
    expect(await existingByNameAndPhone(CTX, DESMOND)).toEqual({
      id: 'desmond',
      doNotContact: false,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          firstName: { equals: 'Desmond', mode: 'insensitive' },
          lastName: { equals: 'Achterberg', mode: 'insensitive' },
        }),
      })
    );
  });

  it('is not matched to someone with the same name on another phone', async () => {
    expect(await existingByNameAndPhone(CTX, { ...DESMOND, phone: '(208) 555-0111' })).toBeNull();
  });

  it('is not matched without a phone or a name', async () => {
    expect(await existingByNameAndPhone(CTX, { ...DESMOND, phone: undefined })).toBeNull();
    expect(await existingByNameAndPhone(CTX, { phone: '(801) 555-0193' })).toBeNull();
  });
});
