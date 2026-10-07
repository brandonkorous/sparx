// Who a bill goes to when nobody typed an address on it.
//
// MEASURED 2026-10-06 on Gillett: invoice 4471, O'Malley Ranch's first bill on
// sparx, raised by hand, had no email on its Bill to and no customer. It is
// locked once issued, and the Send box said "Add one under Bill to first", so
// it could never be sent, with Seamus O'Malley on the account as its buyer
// (sparx persona issue 100).

import { describe, expect, it, vi } from 'vitest';

import { documentRecipient } from './account-contact-billing';

function contact(role: string, email: string) {
  return { role, customer: { email, addresses: [] } };
}

const findMany = vi.fn((): Promise<unknown[]> => Promise.resolve([]));
const tx = { b2bAccountContact: { findMany } } as never;

describe('documentRecipient', () => {
  it('sends to the address on the bill first', async () => {
    expect(
      await documentRecipient(tx, {
        billTo: { email: 'ap@omalleyranch.test' },
        companyId: 'omalley',
        customerEmail: 'someone@omalleyranch.test',
      })
    ).toBe('ap@omalleyranch.test');
  });

  it('then to the customer it was raised for', async () => {
    expect(
      await documentRecipient(tx, {
        billTo: { name: "O'Malley Ranch & Hay Co." },
        companyId: 'omalley',
        customerEmail: 'someone@omalleyranch.test',
      })
    ).toBe('someone@omalleyranch.test');
  });

  it("then to the account's own people, its main contact first", async () => {
    findMany.mockResolvedValueOnce([
      contact('buyer', 'seamus.omalley@omalleyranch.test'),
      contact('primary_contact', 'books@omalleyranch.test'),
    ]);
    expect(
      await documentRecipient(tx, {
        billTo: { name: "O'Malley Ranch & Hay Co." },
        companyId: 'omalley',
        customerEmail: null,
      })
    ).toBe('books@omalleyranch.test');
  });

  it('has nobody when there is no one on file at all', async () => {
    expect(
      await documentRecipient(tx, { billTo: null, companyId: null, customerEmail: null })
    ).toBeNull();
  });
});
