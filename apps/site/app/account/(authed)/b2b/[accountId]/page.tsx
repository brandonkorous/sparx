'use client';

// B2B account dashboard — credit summary, invoice summary, and recent orders
// for one B2B account the customer has access to.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { SparxAlert, SparxBadge, SparxButton } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { getB2bSummary, type B2bPortalSummary } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { statusColor } from '@/lib/status-badge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
      .catch(() => active && setError('Could not load account details.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId]);

  if (error)
    return (
      <SparxAlert color="danger" role="alert">
        {error}
      </SparxAlert>
    );
  if (!summary) return <div className="st-skeleton" style={{ height: 300 }} />;

  const { account, invoiceSummary, recentOrders } = summary;
  const overdueAmount = invoiceSummary.overdueCents + invoiceSummary.unpaidCents;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="st-h2" style={{ marginBottom: '0.25rem' }}>
            {account.companyName}
          </h1>
          <p className="st-muted" style={{ fontSize: '0.9rem' }}>
            {account.role.replace('_', ' ')}
            {account.paymentTerms ? ` · ${account.paymentTerms.toUpperCase()}` : ''}
          </p>
        </div>
        {account.status !== 'active' && (
          <SparxBadge color={statusColor(account.status)}>
            {account.status.replace('_', ' ')}
          </SparxBadge>
        )}
      </div>

      {/* Credit summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="st-card" style={{ padding: '1rem' }}>
          <div className="st-muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            Credit limit
          </div>
          <strong style={{ fontSize: '1.1rem' }}>${account.creditLimit.toLocaleString()}</strong>
        </div>
        <div className="st-card" style={{ padding: '1rem' }}>
          <div className="st-muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            Credit used
          </div>
          <strong style={{ fontSize: '1.1rem' }}>${account.creditUsed.toLocaleString()}</strong>
        </div>
        <div className="st-card" style={{ padding: '1rem' }}>
          <div className="st-muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            Available
          </div>
          <strong
            style={{
              fontSize: '1.1rem',
              color: account.creditAvailable > 0 ? 'var(--st-success)' : 'var(--st-danger)',
            }}
          >
            ${account.creditAvailable.toLocaleString()}
          </strong>
        </div>
        {account.discountPercent > 0 && (
          <div className="st-card" style={{ padding: '1rem' }}>
            <div className="st-muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
              Your discount
            </div>
            <strong style={{ fontSize: '1.1rem' }}>{account.discountPercent}%</strong>
          </div>
        )}
      </div>

      {/* Invoice alerts */}
      {(invoiceSummary.overdueCount > 0 || invoiceSummary.unpaidCount > 0) && (
        <SparxAlert color="warning">
          <strong>
            {invoiceSummary.overdueCount > 0
              ? `${invoiceSummary.overdueCount} overdue ${invoiceSummary.overdueCount === 1 ? 'invoice' : 'invoices'}`
              : `${invoiceSummary.unpaidCount} unpaid ${invoiceSummary.unpaidCount === 1 ? 'invoice' : 'invoices'}`}
          </strong>
          {' — '}
          {formatMoney(overdueAmount, 'USD')} outstanding.{' '}
          <Link href={`/account/b2b/${accountId}/invoices`}>View invoices →</Link>
        </SparxAlert>
      )}

      {/* Quick links */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <SparxButton asChild color="primary" variant="outline">
          <Link href={`/account/b2b/${accountId}/invoices`}>
            Invoices
            {invoiceSummary.unpaidCount + invoiceSummary.overdueCount > 0 && (
              <SparxBadge color="danger" style={{ marginLeft: '0.5rem' }}>
                {invoiceSummary.unpaidCount + invoiceSummary.overdueCount}
              </SparxBadge>
            )}
          </Link>
        </SparxButton>
        <SparxButton asChild color="primary" variant="outline">
          <Link href={`/account/b2b/${accountId}/orders`}>Orders</Link>
        </SparxButton>
        <SparxButton asChild color="primary" variant="outline">
          <Link href={`/account/b2b/${accountId}/quotes`}>Quotes</Link>
        </SparxButton>
        <SparxButton asChild color="primary" variant="outline">
          <Link href={`/account/b2b/${accountId}/appointments`}>Appointments</Link>
        </SparxButton>
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div>
          <h2 className="st-h4" style={{ marginBottom: '0.75rem' }}>
            Recent orders
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="st-card"
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div>
                  <strong>#{o.orderNumber}</strong>
                  <span className="st-muted" style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                    {formatDate(o.createdAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <SparxBadge color={statusColor(o.status)}>{o.status}</SparxBadge>
                  <strong>{formatMoney(o.totalCents, o.currency)}</strong>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link href={`/account/b2b/${accountId}/orders`} className="st-link">
              View all orders →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
