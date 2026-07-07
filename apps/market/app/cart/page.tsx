'use client';

// Marketplace cart (client). Reads the {merchantSlug, cartId, token} triple from
// localStorage, fetches the single-merchant cart snapshot, and renders line items
// with quantity editors, a discount-code field, a totals summary, secure-checkout
// cues, and a checkout CTA. Empty / no-cart / loading / error are all handled.
// sparx.market carts are single-merchant, so the whole cart belongs to one seller.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Loader2, Lock, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Input } from 'silicaui-react';

import { formatCents } from '@/lib/format';
import { Container } from '@/components/ui/layout';
import {
  applyDiscount,
  fetchCart,
  readStoredCart,
  removeCartItem,
  removeDiscount,
  updateCartItem,
  CartRequestError,
  type Cart,
  type StoredCart,
} from '@/lib/cart-client';

export default function CartPage() {
  const [stored, setStored] = useState<StoredCart | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    const s = readStoredCart();
    setStored(s);
    if (!s) {
      setStatus('empty');
      return;
    }
    fetchCart(s)
      .then((c) => {
        setCart(c);
        setStatus(!c || c.items.length === 0 ? 'empty' : 'ready');
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

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!stored || !code.trim()) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      setCart(await applyDiscount(stored, code.trim()));
      setCode('');
    } catch (err) {
      setCodeError(
        err instanceof CartRequestError ? err.message : 'That code can’t be applied right now.'
      );
    } finally {
      setCodeBusy(false);
    }
  }

  async function dropCode(c: string) {
    if (!stored) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      setCart(await removeDiscount(stored, c));
    } catch (err) {
      setCodeError((err as Error).message);
    } finally {
      setCodeBusy(false);
    }
  }

  if (status === 'loading') {
    return (
      <Container className="py-8 md:py-12">
        <div className="flex items-center justify-center gap-2 py-20 text-[var(--color-text-secondary)]">
          <Loader2 size={20} className="animate-spin" aria-hidden />
          Loading your cart…
        </div>
      </Container>
    );
  }

  if (status === 'empty' || !cart) {
    return (
      <Container className="py-8 md:py-12">
        <h1 className="mb-6 text-[1.75rem] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-4xl">
          Your cart
        </h1>
        <EmptyState
          icon={<ShoppingBag size={40} aria-hidden />}
          title="Your cart is empty"
          description="Find something you love from one of our independent sellers."
          actions={
            <Button render={<Link href="/products" />} color="primary" variant="solid" size="md">
              Browse the marketplace
            </Button>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-8 md:py-12">
      <header className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-4xl">
          Your cart
        </h1>
        <p className="mt-2 text-base text-[var(--color-text-secondary)]">
          Items from{' '}
          <Link
            href={`/merchants/${cart.merchantSlug}`}
            className="font-medium text-[var(--sparx-primary)] hover:underline"
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

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Line items */}
        <div className="divide-y divide-[var(--color-border-default)] rounded-xl border border-[var(--color-border-default)]">
          {cart.items.map((line) => {
            const busy = pendingItem === line.id;
            return (
              <div key={line.id} className="flex gap-4 p-4">
                <span className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={line.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-full items-center justify-center text-[var(--color-text-tertiary)]"
                      aria-hidden
                    >
                      <ImageOff size={20} />
                    </span>
                  )}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {line.productSlug ? (
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="text-sm font-semibold text-[var(--color-text-primary)] hover:underline"
                    >
                      {line.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {line.title}
                    </span>
                  )}
                  {line.variantTitle ? (
                    <span className="text-[0.8125rem] text-[var(--color-text-secondary)]">
                      {line.variantTitle}
                    </span>
                  ) : null}
                  <span className="text-[0.8125rem] text-[var(--color-text-secondary)]">
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

                <span className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
                  {formatCents(line.lineTotalCents, cart.currency)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <aside className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 lg:sticky lg:top-32">
          <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
            Order summary
          </h2>

          {/* Discount code */}
          <form onSubmit={submitCode} className="mb-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex min-w-0 flex-1 items-center">
                <Tag
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3 z-10 text-[var(--color-text-tertiary)]"
                />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Discount code"
                  aria-label="Discount code"
                  className="w-full pl-9 uppercase"
                />
              </div>
              <Button
                type="submit"
                color="neutral"
                variant="soft"
                size="md"
                disabled={codeBusy || !code.trim()}
              >
                Apply
              </Button>
            </div>
            {codeError ? (
              <span className="text-[0.8125rem] text-[var(--color-danger)]">{codeError}</span>
            ) : null}
            {cart.appliedDiscountCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {cart.appliedDiscountCodes.map((c) => (
                  <Badge key={c} color="success" variant="soft" size="sm">
                    <span className="uppercase">{c}</span>
                    <button
                      type="button"
                      onClick={() => dropCode(c)}
                      disabled={codeBusy}
                      aria-label={`Remove code ${c}`}
                      className="-mr-1 ml-0.5 inline-flex items-center rounded-full p-0.5 hover:text-[var(--color-text-primary)]"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </form>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCents(cart.totals.subtotalCents, cart.currency)}
              </span>
            </div>
            {cart.totals.discountTotalCents > 0 ? (
              <div className="flex items-center justify-between text-[var(--color-success)]">
                <span>Discount</span>
                <span className="tabular-nums">
                  −{formatCents(cart.totals.discountTotalCents, cart.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-default)] pt-3 text-[1.0625rem] font-bold text-[var(--color-text-primary)]">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCents(cart.totals.totalCents, cart.currency)}
              </span>
            </div>
          </div>

          <Button
            render={<Link href="/checkout" />}
            color="primary"
            variant="solid"
            size="lg"
            className="mt-5 w-full"
          >
            Checkout
          </Button>
          <Button
            render={<Link href="/products" />}
            color="neutral"
            variant="ghost"
            size="md"
            className="mt-2 w-full"
          >
            Continue shopping
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[0.8125rem] text-[var(--color-text-tertiary)]">
            <Lock size={13} aria-hidden />
            Secure checkout — sparx is the merchant of record.
          </p>
        </aside>
      </div>
    </Container>
  );
}
