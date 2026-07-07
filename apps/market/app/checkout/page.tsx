'use client';

// Marketplace checkout page (client). Loads the single-merchant cart from
// localStorage, then hands it to the multi-step CheckoutFlow. Guards the empty /
// no-cart / loading / error states so a shopper without a cart is sent back to
// shopping rather than into a broken flow.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShoppingBag } from 'lucide-react';
import {
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Button,
  EmptyState,
} from 'silicaui-react';

import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { Container } from '@/components/ui/layout';
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
    <Container className="py-8 md:py-12">
      <h1 className="text-base-content mb-6 text-[1.75rem] font-bold tracking-[-0.02em] md:text-4xl">
        Checkout
      </h1>

      {status === 'loading' ? (
        <div className="text-base-content/70 flex items-center justify-center gap-2 py-20">
          <Loader2 size={20} className="animate-spin" aria-hidden />
          Loading your cart…
        </div>
      ) : null}

      {status === 'error' ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>We couldn’t load your cart</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button
              render={<Link href="/cart" />}
              color="primary"
              variant="soft"
              size="sm"
              className="mt-3"
            >
              Back to cart
            </Button>
          </AlertContent>
        </Alert>
      ) : null}

      {status === 'empty' ? (
        <EmptyState
          icon={<ShoppingBag size={40} aria-hidden />}
          title="Your cart is empty"
          description="Add something to your cart before checking out."
          actions={
            <Button render={<Link href="/products" />} color="primary" variant="solid" size="md">
              Browse the marketplace
            </Button>
          }
        />
      ) : null}

      {status === 'ready' && cart ? <CheckoutFlow cart={cart} /> : null}
    </Container>
  );
}
