'use client';

// Wholesale account dashboard: credit, what is owed, and recent orders for one
// trade account the signed-in customer buys for.
//
// The buyer reads words, never codes: her role and terms read "Buyer · Pay
// within 30 days", not "buyer · NET30", and money reads "$4,753.60", not
// "$4,753.6" (sparx persona issue 084). Credit figures arrive in DOLLARS from
// the portal API; everything named `...Cents` is cents.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { ApprovalsWaiting } from '@/components/account/approvals-waiting';
import { ServiceEntryButton } from '@/components/account/service-entry-button';
import { useCustomer } from '@/components/customer-provider';
import { orderStatusLabel, orderStatusTone } from '@/components/order-timeline';
import { getB2bSummary, ORDERING_ROLES, type B2bPortalSummary } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import {
  accountStatusTone,
  accountStatusWords,
  contactRoleWords,
  paymentTermsWords,
} from '@/lib/trade-account-words';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Credit amounts are stored in major units; the formatter takes cents. In the
 *  business's own currency, which the summary now carries: every figure here was
 *  printed in dollars whatever the shop traded in (sparx persona issue 085). */
function major(amount: number, currency: string): string {
  return formatMoney(Math.round(amount * 100), currency);
}

function invoiceCount(n: number): string {
  return n === 1 ? '1 invoice' : `${n} invoices`;
}

export default function B2bAccountPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [summary, setSummary] = useState<B2bPortalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getB2bSummary(tenantSlug, accountId)
      .then((s) => active && setSummary(s))
      .catch(() => active && setError('Your wholesale account could not be loaded just now.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId]);

  if (error)
    return (
      <Alert color="danger" role="alert">
        {error}
      </Alert>
    );
  if (!summary) return <div className="skeleton h-75" />;

  const { account, invoiceSummary, recentOrders } = summary;
  const terms = paymentTermsWords(account.paymentTerms);
  const openInvoices = invoiceSummary.unpaidCount + invoiceSummary.overdueCount;
  // An account with no credit line does not trade on credit: a row of $0.00
  // cards would read as a limit of nothing rather than as no limit at all.
  const hasCredit = account.creditLimit > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base-content text-3xl font-semibold tracking-tight">
            {account.companyName}
          </h1>
          <p className="text-base-content">
            {contactRoleWords(account.role)}
            {terms ? ` · ${terms}` : ''}
          </p>
        </div>
        {account.status !== 'active' && (
          <Badge color={accountStatusTone(account.status)} variant="soft">
            {accountStatusWords(account.status)}
          </Badge>
        )}
      </div>

      {/* An approver's first job on this page: the account's orders waiting
          for their yes (sparx persona issue 087). Asked for only for an
          approver; the server refuses everyone else. */}
      {account.role === 'approver' && (
        <ApprovalsWaiting tenantSlug={tenantSlug} accountId={accountId} />
      )}

      {(hasCredit || account.discountPercent > 0) && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {hasCredit && (
            <>
              <div className="card border-base-300 gap-1 border p-4">
                <span className="text-base-content text-sm">Credit limit</span>
                <strong className="text-lg">{major(account.creditLimit, account.currency)}</strong>
              </div>
              <div className="card border-base-300 gap-1 border p-4">
                <span className="text-base-content text-sm">Credit used</span>
                <strong className="text-lg">{major(account.creditUsed, account.currency)}</strong>
              </div>
              <div className="card border-base-300 gap-1 border p-4">
                <span className="text-base-content text-sm">Available to spend</span>
                <strong
                  className={
                    account.creditAvailable > 0 ? 'text-success text-lg' : 'text-danger text-lg'
                  }
                >
                  {major(account.creditAvailable, account.currency)}
                </strong>
              </div>
            </>
          )}
          {account.discountPercent > 0 && (
            <div className="card border-base-300 gap-1 border p-4">
              <span className="text-base-content text-sm">Your discount</span>
              <strong className="text-lg">{account.discountPercent}% off</strong>
            </div>
          )}
        </div>
      )}

      {openInvoices > 0 && (
        <Alert color={invoiceSummary.overdueCount > 0 ? 'danger' : 'warning'}>
          <span>
            {invoiceSummary.overdueCount > 0 && (
              <>
                <strong>
                  {invoiceCount(invoiceSummary.overdueCount)}{' '}
                  {invoiceSummary.overdueCount === 1 ? 'is' : 'are'} overdue:{' '}
                  {formatMoney(invoiceSummary.overdueCents, account.currency)}.
                </strong>{' '}
              </>
            )}
            {invoiceSummary.unpaidCount > 0 && (
              <>
                {invoiceCount(invoiceSummary.unpaidCount)}{' '}
                {invoiceSummary.unpaidCount === 1 ? 'is' : 'are'} not yet paid:{' '}
                {formatMoney(invoiceSummary.unpaidCents, account.currency)}.{' '}
              </>
            )}
            <Link href={`/account/b2b/${accountId}/invoices`} className="link">
              See your invoices
            </Link>
          </span>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          render={<Link href={`/account/b2b/${accountId}/invoices`} />}
          color="primary"
          variant="outline"
        >
          Invoices
          {openInvoices > 0 && (
            <Badge color="danger" size="sm" className="ml-2">
              {openInvoices}
            </Badge>
          )}
        </Button>
        <Button
          render={<Link href={`/account/b2b/${accountId}/orders`} />}
          color="primary"
          variant="outline"
        >
          Orders
        </Button>
        <Button
          render={<Link href={`/account/b2b/${accountId}/quotes`} />}
          color="primary"
          variant="outline"
        >
          Quotes
        </Button>
        {/* The account's named lists, for whoever on it can order (sparx
            persona issue 086). */}
        {ORDERING_ROLES.has(account.role) && (
          <Button
            render={<Link href={`/account/b2b/${accountId}/saved-carts`} />}
            color="primary"
            variant="outline"
          >
            Saved carts
          </Button>
        )}
        {/* What was owed, billed and paid in a period, with the PO number on
            every line: the page an accounts department reconciles against. */}
        <Button
          render={<Link href={`/account/b2b/${accountId}/statement`} />}
          color="primary"
          variant="outline"
        >
          Statement
        </Button>
        {/* The vehicles the account runs, and the parts that fit each one
            (sparx persona issue 086). */}
        <Button
          render={<Link href={`/account/b2b/${accountId}/fleet`} />}
          color="primary"
          variant="outline"
        >
          Fleet
        </Button>
        {/* Book service for the fleet: only when the shop takes bookings
            (sparx persona issue 086). */}
        <ServiceEntryButton accountId={accountId} />
      </div>

      {recentOrders.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base-content text-xl font-semibold">Recent orders</h2>
          <div className="flex flex-col gap-2">
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="card border-base-300 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-4 py-3"
              >
                <div className="min-w-0">
                  {/* An order number is one token: it must not break across lines. */}
                  <Link
                    href={`/account/b2b/${accountId}/orders/${o.id}`}
                    className="link link-primary font-semibold whitespace-nowrap"
                  >
                    {o.orderNumber}
                  </Link>
                  <div className="text-base-content text-sm">{formatDate(o.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={orderStatusTone(o.status)} variant="soft">
                    {orderStatusLabel(o.status)}
                  </Badge>
                  <strong className="whitespace-nowrap">
                    {formatMoney(o.totalCents, o.currency)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
          <Link href={`/account/b2b/${accountId}/orders`} className="link link-primary">
            See all orders
          </Link>
        </div>
      )}
    </div>
  );
}
