// Whose tax exemption certificates apply when somebody buys.
//
// A certificate is filed on ONE of two things: a customer, or the wholesale
// account they buy for (the CRM company row; a trade account's id IS the
// company id). Checkout used to look only at the customer, so a certificate
// filed where a trade business naturally keeps it, on the account, was ignored
// for every person ordering on that account's behalf. They paid sales tax the
// shop had a certificate on file to stop (sparx persona issue 075).
//
// The account is resolved by the SAME rule pricing and net terms use
// (`resolveActiveB2bAccountId`): the customer's primary account, and only while
// they are still an active contact on it. Someone who has left the business
// loses its prices and its terms, and loses its certificate with them.
//
// One module, read by checkout, repeat deliveries and the screen that shows
// the owner which certificates cover a customer, so the screen and the till
// cannot disagree about it.

import type { TxClient } from '@wizeworks/db';

import { resolveActiveB2bAccountId } from './pricing-service';

/** The wholesale account this customer buys for right now, if any. */
export async function buyingAccountId(
  tx: TxClient,
  customerId: string | null | undefined
): Promise<string | undefined> {
  if (!customerId) return undefined;
  const customer = await tx.customer.findFirst({
    where: { id: customerId },
    select: { companyId: true },
  });
  return resolveActiveB2bAccountId(tx, customerId, customer?.companyId);
}

/** Every certificate that applies when this customer buys: their own, and the
 *  ones on the account they buy for. Empty for a guest. */
export async function exemptionIdsForBuyer(
  tx: TxClient,
  customerId: string | null | undefined
): Promise<string[]> {
  if (!customerId) return [];
  const accountId = await buyingAccountId(tx, customerId);
  const rows = await tx.taxExemption.findMany({
    where: {
      OR: [{ customerId }, ...(accountId ? [{ companyId: accountId }] : [])],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
