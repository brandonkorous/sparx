'use client';

// B2B portal — invoice list for one account.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { getB2bInvoices, type B2bInvoiceEntry } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Button } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusBadgeProps(status: string): { 'data-status': string } {
  return {
    'data-status': status === 'paid' ? 'success' : status === 'overdue' ? 'danger' : 'warning',
  };
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
      .catch(() => active && setError('Could not load invoices.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, skip]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <Link href={`/account/b2b/${accountId}`} className="st-link" style={{ fontSize: '0.9rem' }}>
          ← Back
        </Link>
        <h1 className="st-h2">Invoices</h1>
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : invoices === null ? (
        <div className="st-skeleton" style={{ height: 200 }} />
      ) : invoices.length === 0 ? (
        <div className="st-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="st-muted">No invoices found.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {invoices.map((inv) => {
              const isOverdue = inv.status === 'overdue';
              return (
                <div
                  key={inv.id}
                  className="st-card"
                  style={{
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <strong>{inv.invoiceNumber}</strong>
                    <div className="st-muted" style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>
                      Due {formatDate(inv.dueAt)}
                      {isOverdue && inv.overdueDays > 0 && (
                        <span style={{ color: 'var(--st-danger)', marginLeft: '0.4rem' }}>
                          · {inv.overdueDays}d overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="st-badge" {...statusBadgeProps(inv.status)}>
                      {inv.status}
                    </span>
                    <strong style={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(inv.amountCents, 'USD')}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="st-muted" style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}>
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
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
