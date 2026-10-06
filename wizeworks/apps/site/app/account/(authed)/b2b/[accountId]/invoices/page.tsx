'use client';

// Wholesale account: the invoices the shop has issued to one trade account.
// Quotes and unsent drafts are not invoices and are left out by the portal API.
//
// A partly paid invoice shows what is still owed beside what it was for, and a
// status reads as a word ("Partly paid"), never the stored code (sparx persona
// issue 084).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { getB2bInvoices, type B2bInvoiceEntry } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { invoiceStatusTone, invoiceStatusWords } from '@/lib/trade-account-words';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The line under the invoice number: when it is due, or when it was paid. */
function dueLine(inv: B2bInvoiceEntry): string | null {
  if (inv.status === 'paid') return inv.paidAt ? `Paid ${formatDate(inv.paidAt)}` : null;
  return inv.dueAt ? `Due ${formatDate(inv.dueAt)}` : null;
}

export default function B2bInvoicesPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [invoices, setInvoices] = useState<B2bInvoiceEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setInvoices(null);
    setError(null);
    getB2bInvoices(tenantSlug, accountId, skip, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        setInvoices(res.items);
        setTotal(res.total);
      })
      .catch(
        () => active && setError('The invoices on this account could not be loaded just now.')
      );
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, skip]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Link href={`/account/b2b/${accountId}`} className="link link-primary">
          ← Back to account
        </Link>
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Invoices</h1>
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : invoices === null ? (
        <div className="skeleton h-50" />
      ) : invoices.length === 0 ? (
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content">There are no invoices on this account yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {invoices.map((inv) => {
              const isOverdue = inv.status === 'overdue';
              const partlyPaid = inv.status !== 'paid' && inv.balanceCents < inv.amountCents;
              const when = dueLine(inv);
              const late = isOverdue && inv.overdueDays > 0;
              return (
                <div
                  key={inv.id}
                  className="card border-base-300 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <strong className="whitespace-nowrap">{inv.invoiceNumber}</strong>
                    {(when !== null || late) && (
                      <div className="text-base-content text-sm">
                        {when}
                        {late && (
                          <span className="text-danger">
                            {when ? ' · ' : ''}
                            {inv.overdueDays === 1 ? '1 day' : `${inv.overdueDays} days`} late
                          </span>
                        )}
                      </div>
                    )}
                    {inv.poNumber && (
                      <div className="text-base-content text-sm">Your PO number {inv.poNumber}</div>
                    )}
                    {/* The invoice as the shop prints it, to keep or send on to
                        accounts (sparx persona issue 085). */}
                    <Link
                      href={`/account/b2b/${accountId}/documents/${inv.id}`}
                      className="link link-primary text-sm"
                    >
                      Print or save as PDF
                    </Link>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color={invoiceStatusTone(inv.status)} variant="soft">
                      {invoiceStatusWords(inv.status)}
                    </Badge>
                    <div className="flex flex-col items-end">
                      <strong className="whitespace-nowrap">
                        {formatMoney(partlyPaid ? inv.balanceCents : inv.amountCents, inv.currency)}
                      </strong>
                      {partlyPaid && (
                        <span className="text-base-content text-sm whitespace-nowrap">
                          left of {formatMoney(inv.amountCents, inv.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-base-content text-sm">
                {skip + 1} to {Math.min(skip + PAGE_SIZE, total)} of {total}
              </span>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip + PAGE_SIZE >= total}
                onClick={() => setSkip(skip + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
