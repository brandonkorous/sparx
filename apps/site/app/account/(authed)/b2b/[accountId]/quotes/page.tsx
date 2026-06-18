'use client';

// B2B portal — quote list for one account.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { SparxAlert, SparxBadge, SparxButton } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { getB2bQuotes, type B2bQuoteEntry } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { statusColor } from '@/lib/status-badge';

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function B2bQuotesPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [quotes, setQuotes] = useState<B2bQuoteEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setQuotes(null);
    setError(null);
    getB2bQuotes(tenantSlug, accountId, skip, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        setQuotes(res.items);
        setTotal(res.total);
      })
      .catch(() => active && setError('Could not load quotes.'));
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
        <h1 className="st-h2">Quotes</h1>
      </div>

      {error ? (
        <SparxAlert color="danger" role="alert">
          {error}
        </SparxAlert>
      ) : quotes === null ? (
        <div className="st-skeleton" style={{ height: 200 }} />
      ) : quotes.length === 0 ? (
        <div className="st-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="st-muted">No quotes found on this account.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {quotes.map((q) => (
              <div
                key={q.id}
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
                  <strong>{q.quoteNumber}</strong>
                  <div className="st-muted" style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>
                    Valid until {formatDate(q.validUntil)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <SparxBadge color={statusColor(q.status)}>{q.status}</SparxBadge>
                  <strong style={{ whiteSpace: 'nowrap' }}>
                    {formatMoney(q.totalCents, q.currency)}
                  </strong>
                </div>
              </div>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <SparxButton
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </SparxButton>
              <span className="st-muted" style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}>
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
              </span>
              <SparxButton
                type="button"
                color="primary"
                variant="outline"
                disabled={skip + PAGE_SIZE >= total}
                onClick={() => setSkip(skip + PAGE_SIZE)}
              >
                Next
              </SparxButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
