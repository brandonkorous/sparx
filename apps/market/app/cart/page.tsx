'use client';

// Marketplace cart (client). Reads the {merchantSlug, cartId, token} triple from
// localStorage, fetches the single-merchant cart snapshot, and renders line items
// with quantity editors + a totals summary + a checkout CTA. Empty / no-cart /
// loading / error are all handled. sparx.market carts are single-merchant, so the
// whole cart belongs to one seller (surfaced in the header).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Alert, Button } from '@sparx/ui';

import { formatCents } from '@/lib/format';
import {
  fetchCart,
  readStoredCart,
  removeCartItem,
  updateCartItem,
  type Cart,
  type StoredCart,
} from '@/lib/cart-client';

export default function CartPage() {
  const [stored, setStored] = useState<StoredCart | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);

  useEffect(() => {
    const s = readStoredCart();
    setStored(s);
    if (!s) {
      setStatus('empty');
      return;
    }
    fetchCart(s)
      .then((c) => {
        if (!c || c.items.length === 0) {
          setCart(c);
          setStatus('empty');
        } else {
          setCart(c);
          setStatus('ready');
        }
      })
      .catch((err) => {
        setError((err as Error).message);
        setStatus('error');
      });
  }, []);

  const mutate = useCallback(
    async (itemId: string, action: (s: StoredCart) => Promise<Cart>) => {
      if (!stored) return;
      setPendingItem(itemId);
      setError(null);
      try {
        const next = await action(stored);
        setCart(next);
        setStatus(next.items.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPendingItem(null);
      }
    },
    [stored]
  );

  if (status === 'loading') {
    return (
      <div className="mx-container mx-section">
        <div className="mx-empty">
          <Loader2 size={32} className="animate-spin" aria-hidden />
          <p>Loading your cart…</p>
        </div>
      </div>
    );
  }

  if (status === 'empty' || !cart) {
    return (
      <div className="mx-container mx-section">
        <h1 className="mx-page-title mb-6">Your cart</h1>
        <div className="mx-empty">
          <span className="mx-empty__icon" aria-hidden>
            <ShoppingBag size={40} />
          </span>
          <p className="mx-empty__title">Your cart is empty</p>
          <p>Find something you love from one of our independent sellers.</p>
          <Button asChild color="primary" variant="solid" size="md">
            <Link href="/products">Browse the marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-container mx-section">
      <header className="mb-6">
        <h1 className="mx-page-title">Your cart</h1>
        <p className="mx-page-lead">
          Items from{' '}
          <Link
            href={`/merchants/${cart.merchantSlug}`}
            className="font-medium hover:underline"
            style={{ color: 'var(--sparx-primary)' }}
          >
            {cart.merchantSlug}
          </Link>
          . A sparx.market cart holds items from one seller.
        </p>
      </header>

      {error ? (
        <Alert color="danger" variant="soft" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <div className="mx-checkout">
        {/* Line items */}
        <div>
          {cart.items.map((line) => {
            const busy = pendingItem === line.id;
            return (
              <div key={line.id} className="mx-line">
                <span className="mx-line__media">
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt={line.title} fill sizes="64px" />
                  ) : (
                    <span className="flex h-full items-center justify-center" aria-hidden>
                      <ImageOff size={20} style={{ color: 'var(--color-text-secondary)' }} />
                    </span>
                  )}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {line.productSlug ? (
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="mx-line__title hover:underline"
                    >
                      {line.title}
                    </Link>
                  ) : (
                    <span className="mx-line__title">{line.title}</span>
                  )}
                  {line.variantTitle ? (
                    <span className="mx-line__meta">{line.variantTitle}</span>
                  ) : null}
                  <span className="mx-line__meta">
                    {formatCents(line.unitPriceCents, cart.currency)} each
                  </span>

                  <div className="mt-1 flex items-center gap-1">
                    <Button
                      type="button"
                      color="neutral"
                      variant="outline"
                      size="sm"
                      shape="square"
                      aria-label="Decrease quantity"
                      disabled={busy || line.quantity <= 1}
                      onClick={() =>
                        mutate(line.id, (s) => updateCartItem(s, line.id, line.quantity - 1))
                      }
                    >
                      <Minus size={14} aria-hidden />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      color="neutral"
                      variant="outline"
                      size="sm"
                      shape="square"
                      aria-label="Increase quantity"
                      disabled={busy}
                      onClick={() =>
                        mutate(line.id, (s) => updateCartItem(s, line.id, line.quantity + 1))
                      }
                    >
                      <Plus size={14} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      color="danger"
                      variant="ghost"
                      size="sm"
                      shape="square"
                      aria-label={`Remove ${line.title}`}
                      disabled={busy}
                      onClick={() => mutate(line.id, (s) => removeCartItem(s, line.id))}
                    >
                      <Trash2 size={15} aria-hidden />
                    </Button>
                  </div>
                </div>

                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {formatCents(line.lineTotalCents, cart.currency)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <aside className="mx-summary">
          <h2
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Order summary
          </h2>
          <div className="mx-totals">
            <div className="mx-totals__row">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCents(cart.totals.subtotalCents, cart.currency)}
              </span>
            </div>
            {cart.totals.discountTotalCents > 0 ? (
              <div className="mx-totals__row">
                <span>Discount</span>
                <span className="tabular-nums">
                  −{formatCents(cart.totals.discountTotalCents, cart.currency)}
                </span>
              </div>
            ) : null}
            <div className="mx-totals__row">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="mx-totals__row mx-totals__row--grand">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCents(cart.totals.totalCents, cart.currency)}
              </span>
            </div>
          </div>

          <Button asChild color="primary" variant="solid" size="lg" className="mt-5 w-full">
            <Link href="/checkout">Checkout</Link>
          </Button>
          <Button asChild color="neutral" variant="ghost" size="md" className="mt-2 w-full">
            <Link href="/products">Continue shopping</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
