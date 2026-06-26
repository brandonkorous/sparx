'use client';

// Marketplace checkout page (client). Loads the single-merchant cart from
// localStorage, then hands it to the multi-step CheckoutFlow. Guards the empty /
// no-cart / loading / error states so a shopper without a cart is sent back to
// shopping rather than into a broken flow.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShoppingBag } from 'lucide-react';
import { Alert, Button } from '@sparx/ui';

import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { fetchCart, readStoredCart, type Cart } from '@/lib/cart-client';

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredCart();
    if (!stored) {
      setStatus('empty');
      return;
    }
    fetchCart(stored)
      .then((c) => {
        if (!c || c.items.length === 0) {
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

  return (
    <div className="mx-container mx-section">
      <h1 className="mx-page-title mb-6">Checkout</h1>

      {status === 'loading' ? (
        <div className="mx-empty">
          <Loader2 size={32} className="animate-spin" aria-hidden />
          <p>Loading your cart…</p>
        </div>
      ) : null}

      {status === 'error' ? (
        <Alert color="danger" variant="soft" title="We couldn’t load your cart">
          <p className="mb-3">{error}</p>
          <Button asChild color="primary" variant="soft" size="sm">
            <Link href="/cart">Back to cart</Link>
          </Button>
        </Alert>
      ) : null}

      {status === 'empty' ? (
        <div className="mx-empty">
          <span className="mx-empty__icon" aria-hidden>
            <ShoppingBag size={40} />
          </span>
          <p className="mx-empty__title">Your cart is empty</p>
          <p>Add something to your cart before checking out.</p>
          <Button asChild color="primary" variant="solid" size="md">
            <Link href="/products">Browse the marketplace</Link>
          </Button>
        </div>
      ) : null}

      {status === 'ready' && cart ? <CheckoutFlow cart={cart} /> : null}
    </div>
  );
}
