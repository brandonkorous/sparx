'use client';

// On the account overview: where each wholesale account the person buys for
// stands. How much credit is left to spend, and what is owed, overdue first.
//
// A fleet buyer's account can stop an order: one past the credit left waits for
// the shop (sparx persona issue 187), and a late invoice is what uses the credit
// up. Renée's overview said none of it; she had to know to open Wholesale
// account (sparx persona issue 193). The words are the ones that page uses.
// Nothing is drawn for someone who buys on no wholesale account, or when the
// accounts cannot be read: that page still says it.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { getB2bAccounts, getB2bSummary, type B2bPortalSummary } from '@/lib/customer-client';
import { creditLeftWords, openInvoiceWords } from '@/lib/trade-account-words';

export function AccountStanding() {
  const { tenantSlug, status, offers, customer } = useCustomer();
  const customerId = customer?.id ?? null;
  const [standing, setStanding] = useState<(B2bPortalSummary & { accountId: string })[]>([]);

  useEffect(() => {
    if (status !== 'authenticated' || !offers.b2b) {
      setStanding([]);
      return;
    }
    let active = true;
    getB2bAccounts(tenantSlug)
      .then((accounts) =>
        Promise.all(
          accounts.map((a) =>
            getB2bSummary(tenantSlug, a.accountId)
              // The id from the list: an older summary carries none of its own.
              .then((summary) => ({ ...summary, accountId: a.accountId }))
              // One account that cannot be read must not hide the others.
              .catch(() => null)
          )
        )
      )
      .then((found) => {
        if (!active) return;
        setStanding(found.filter((s) => s !== null));
      })
      .catch(() => active && setStanding([]));
    return () => {
      active = false;
    };
  }, [tenantSlug, status, offers.b2b, customerId]);

  if (standing.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {standing.map(({ accountId, account, invoiceSummary }) => {
        const credit = creditLeftWords(account, account.currency);
        const owed = openInvoiceWords(invoiceSummary, account.currency);
        const href = `/account/b2b/${accountId}`;
        return (
          <section key={accountId} className="card border-base-300 gap-3 border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-base-content m-0 text-xl font-semibold">{account.companyName}</h2>
              <Link href={href} className="link link-primary">
                Open the account
              </Link>
            </div>
            {credit && <p className="text-base-content m-0">{credit}</p>}
            {(owed.overdue ?? owed.unpaid) && (
              <Alert color={owed.overdue ? 'danger' : 'warning'}>
                <span>
                  {owed.overdue && (
                    <>
                      <strong>{owed.overdue}</strong>{' '}
                    </>
                  )}
                  {owed.unpaid && <>{owed.unpaid} </>}
                  <Link href={`${href}/invoices`} className="link">
                    See your invoices
                  </Link>
                </span>
              </Alert>
            )}
          </section>
        );
      })}
    </div>
  );
}
