'use client';

// B2B account dashboard — credit summary, invoice summary, and recent orders
// for one B2B account the customer has access to.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { orderStatusTone } from '@/components/order-timeline';
import { getB2bSummary, type B2bPortalSummary } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Semantic tone for a B2B account status. */
function accountStatusTone(status: string) {
  switch (status) {
    case 'credit_hold':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'inactive':
      return 'neutral';
    default:
      return 'success';
  }
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
      <Alert color="danger" role="alert">
        {error}
      </Alert>
    );
  if (!summary) return <div className="skeleton" style={{ height: 300 }} />;

  const { account, invoiceSummary, recentOrders } = summary;
  const overdueAmount = invoiceSummary.overdueCents + invoiceSummary.unpaidCents;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1
            className="text-base-content text-3xl font-semibold tracking-tight"
            style={{ marginBottom: '0.25rem' }}
          >
            {account.companyName}
          </h1>
          <p className="text-base-content" style={{ fontSize: '0.9rem' }}>
            {account.role.replace('_', ' ')}
            {account.paymentTerms ? ` · ${account.paymentTerms.toUpperCase()}` : ''}
          </p>
        </div>
        {account.status !== 'active' && (
          <Badge color={accountStatusTone(account.status)} variant="soft">
            {account.status.replace('_', ' ')}
          </Badge>
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
        <div className="card border-base-300 border" style={{ padding: '1rem' }}>
          <div
            className="text-base-content"
            style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}
          >
            Credit limit
          </div>
          <strong style={{ fontSize: '1.1rem' }}>${account.creditLimit.toLocaleString()}</strong>
        </div>
        <div className="card border-base-300 border" style={{ padding: '1rem' }}>
          <div
            className="text-base-content"
            style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}
          >
            Credit used
          </div>
          <strong style={{ fontSize: '1.1rem' }}>${account.creditUsed.toLocaleString()}</strong>
        </div>
        <div className="card border-base-300 border" style={{ padding: '1rem' }}>
          <div
            className="text-base-content"
            style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}
          >
            Available
          </div>
          <strong
            className={account.creditAvailable > 0 ? 'text-success' : 'text-danger'}
            style={{ fontSize: '1.1rem' }}
          >
            ${account.creditAvailable.toLocaleString()}
          </strong>
        </div>
        {account.discountPercent > 0 && (
          <div className="card border-base-300 border" style={{ padding: '1rem' }}>
            <div
              className="text-base-content"
              style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}
            >
              Your discount
            </div>
            <strong style={{ fontSize: '1.1rem' }}>{account.discountPercent}%</strong>
          </div>
        )}
      </div>

      {/* Invoice alerts */}
      {(invoiceSummary.overdueCount > 0 || invoiceSummary.unpaidCount > 0) && (
        <Alert color="warning">
          <strong>
            {invoiceSummary.overdueCount > 0
              ? `${invoiceSummary.overdueCount} overdue ${invoiceSummary.overdueCount === 1 ? 'invoice' : 'invoices'}`
              : `${invoiceSummary.unpaidCount} unpaid ${invoiceSummary.unpaidCount === 1 ? 'invoice' : 'invoices'}`}
          </strong>
          {' — '}
          {formatMoney(overdueAmount, 'USD')} outstanding.{' '}
          <Link href={`/account/b2b/${accountId}/invoices`}>View invoices →</Link>
        </Alert>
      )}

      {/* Quick links */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button
          render={<Link href={`/account/b2b/${accountId}/invoices`} />}
          color="primary"
          variant="outline"
        >
          Invoices
          {invoiceSummary.unpaidCount + invoiceSummary.overdueCount > 0 && (
            <Badge color="danger" size="sm" className="ml-2">
              {invoiceSummary.unpaidCount + invoiceSummary.overdueCount}
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
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div>
          <h2
            className="text-base-content text-xl font-semibold"
            style={{ marginBottom: '0.75rem' }}
          >
            Recent orders
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="card border-base-300 border"
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
                  <span
                    className="text-base-content"
                    style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}
                  >
                    {formatDate(o.createdAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Badge color={orderStatusTone(o.status)} variant="soft">
                    {o.status}
                  </Badge>
                  <strong>{formatMoney(o.totalCents, o.currency)}</strong>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link href={`/account/b2b/${accountId}/orders`} className="link link-primary">
              View all orders →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
