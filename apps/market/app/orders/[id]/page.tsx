// Order confirmation / status page. Reached after checkout completes (and
// bookmarkable). Reads `?merchant=` to scope the public order view to the seller.
// Order data is never cached (status changes after placement). Not indexable — a
// per-order transactional page.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, MapPin } from 'lucide-react';
import { Badge, Button } from 'silicaui-react';

import { statusLabel, statusTone } from '@/lib/status';
import { getOrder } from '@/lib/market';
import { Container } from '@/components/ui/layout';
import { formatCents } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order confirmation',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function formatPlacedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const merchantSlug = one(sp.merchant);
  if (!merchantSlug) notFound();

  const order = await getOrder(id, merchantSlug);
  if (!order) notFound();

  const shippingParts = [order.shippingCity, order.shippingRegion, order.shippingCountry].filter(
    (p): p is string => Boolean(p)
  );

  return (
    <Container className="py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        {/* Confirmation header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span style={{ color: 'var(--color-success)' }}>
            <CheckCircle2 size={48} aria-hidden />
          </span>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-4xl">
            Order confirmed
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Thanks for your order! A confirmation email is on its way. Your order number is{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{order.orderNumber}</strong>.
          </p>
        </div>

        {/* Order card */}
        <div
          className="mt-8 rounded-xl border p-5 sm:p-6"
          style={{
            borderColor: 'var(--color-border-default)',
            background: 'var(--color-bg-surface)',
          }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"
            style={{ borderColor: 'var(--color-border-default)' }}
          >
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Order {order.orderNumber}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Placed {formatPlacedAt(order.placedAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={statusTone(order.status)} variant="soft">
                {statusLabel(order.status)}
              </Badge>
              <Badge color={statusTone(order.paymentStatus)} variant="soft">
                {statusLabel(order.paymentStatus)}
              </Badge>
            </div>
          </div>

          {/* Items */}
          <div className="py-2">
            {order.items.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span
                  className="min-w-0 flex-1 text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {item.name}
                  <span style={{ color: 'var(--color-text-secondary)' }}> × {item.quantity}</span>
                </span>
                <span
                  className="text-sm font-medium tabular-nums"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {formatCents(item.lineTotalCents, order.currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            className="flex items-center justify-between border-t pt-4 text-base font-semibold"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span>Total</span>
            <span className="tabular-nums">{formatCents(order.totalCents, order.currency)}</span>
          </div>

          {/* Shipping destination */}
          {shippingParts.length > 0 ? (
            <div
              className="mt-4 flex items-center gap-2 border-t pt-4 text-sm"
              style={{
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <MapPin size={15} aria-hidden />
              Shipping to {shippingParts.join(', ')}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex justify-center">
          <Button render={<Link href="/products" />} color="primary" variant="solid" size="md">
            Continue shopping
          </Button>
        </div>
      </div>
    </Container>
  );
}
