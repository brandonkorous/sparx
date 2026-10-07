// Where a trade account is billed when no bill says so yet.
//
// The account record has no address or email of its own. Once the shop has
// billed them, the last bill is the answer (the statement and an order's
// invoice both look there first). Before that, the people on the account are:
// its main contact first, then anyone else who orders for it, oldest first.
//
// One copy, read by both the statement and a new invoice on account. The
// invoice did not have it: a bill Doty raised by hand for O'Malley Ranch, their
// first on sparx, was made out to the company name alone, and "Invoice on
// terms: email it to the buyer" failed with "There is no email address to send
// this to" while Seamus O'Malley sat on the account as its buyer (sparx persona
// issue 100).

import type { Prisma } from '@wizeworks/db';

import { partyFromJson } from './billing-render-parts';

export interface AccountContactBilling {
  /** The first contact's email, in the order above, or null. */
  email: string | null;
  /** The first billing address any contact has, as printable lines. */
  lines: string[];
}

export async function accountContactBilling(
  tx: Prisma.TransactionClient,
  accountId: string
): Promise<AccountContactBilling> {
  const contacts = await tx.b2bAccountContact.findMany({
    where: { accountId, isActive: true, customer: { deletedAt: null } },
    select: {
      role: true,
      customer: {
        select: {
          email: true,
          addresses: {
            where: { type: { in: ['billing', 'both'] } },
            select: {
              isDefault: true,
              line1: true,
              line2: true,
              city: true,
              region: true,
              postalCode: true,
              country: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const ordered = [
    ...contacts.filter((c) => c.role === 'primary_contact'),
    ...contacts.filter((c) => c.role !== 'primary_contact'),
  ];

  const email =
    ordered.map((c) => c.customer.email?.trim() ?? '').find((value) => value.length > 0) ?? null;

  for (const contact of ordered) {
    const address = [...contact.customer.addresses].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault)
    )[0];
    if (!address) continue;
    const party = partyFromJson(
      {
        line1: address.line1,
        line2: address.line2 ?? '',
        city: address.city,
        region: address.region ?? '',
        postalCode: address.postalCode ?? '',
        country: address.country,
      },
      'Bill to'
    );
    if (party && party.lines.length > 0) return { email, lines: party.lines };
  }
  return { email, lines: [] };
}

/**
 * Who a billing document is emailed to: the address frozen on its Bill to,
 * else its customer's, else the trade account's own people (above).
 *
 * The page and the email both ask, and each asked only the first two. Invoice
 * 4471 for O'Malley Ranch had neither, and it is locked once issued, so the
 * Send box said "Add one under Bill to first" over a Bill to nobody can edit:
 * the invoice could never be sent (sparx persona issue 100).
 */
export async function documentRecipient(
  tx: Prisma.TransactionClient,
  doc: { billTo: Prisma.JsonValue; companyId: string | null; customerEmail: string | null }
): Promise<string | null> {
  const billTo =
    doc.billTo && typeof doc.billTo === 'object' && !Array.isArray(doc.billTo)
      ? (doc.billTo as Record<string, unknown>)
      : {};
  const frozen = typeof billTo.email === 'string' ? billTo.email.trim() : '';
  if (frozen) return frozen;
  const customer = doc.customerEmail?.trim() ?? '';
  if (customer) return customer;
  return doc.companyId ? (await accountContactBilling(tx, doc.companyId)).email : null;
}
