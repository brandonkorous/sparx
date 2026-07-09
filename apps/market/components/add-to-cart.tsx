'use client';

// Product detail buy-box (client). Variant selector + quantity + add-to-cart,
// driving the single-merchant cart. The market cart is per-merchant: if the
// shopper already has a cart from a DIFFERENT seller, adding from this seller
// prompts to start a fresh cart (the per-merchant guard), since a cart can hold
// only one seller's items.

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import { formatCents } from '@/lib/format';
import { addCartItem, createCart, readStoredCart } from '@/lib/cart-client';
import type { ListingVariant } from '@/lib/market';

export interface AddToCartProps {
  merchantSlug: string;
  merchantName: string;
  variants: ListingVariant[];
  currency: string;
}

export function AddToCart({ merchantSlug, merchantName, variants, currency }: AddToCartProps) {
  const router = useRouter();

  const sellableVariants = variants;
  const firstInStock = useMemo(
    () => sellableVariants.find((v) => v.inStock) ?? sellableVariants[0],
    [sellableVariants]
  );

  const [variantId, setVariantId] = useState<string | undefined>(firstInStock?.variantId);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  // When set, a different-merchant cart exists; we hold the requested add until
  // the shopper confirms starting a new cart.
  const [conflict, setConflict] = useState<{ otherMerchant: string } | null>(null);

  const selected = sellableVariants.find((v) => v.variantId === variantId) ?? firstInStock;
  const canBuy = Boolean(selected?.inStock);

  if (sellableVariants.length === 0) {
    return (
      <Alert color="neutral" variant="soft">
        This product isn’t available to purchase right now.
      </Alert>
    );
  }

  async function startNewCart() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setConflict(null);
    try {
      // Discard the other-merchant cart: a fresh createCart issues a new
      // ownership triple and overwrites the stored one (single-merchant model).
      await createCart(merchantSlug, selected.variantId, quantity);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onAdded() {
    setAdded(true);
    // Reflect the new count in the header cart icon on next navigation.
    router.refresh();
    window.setTimeout(() => setAdded(false), 2500);
  }

  async function handleAdd() {
    if (!selected) return;
    setError(null);

    const stored = readStoredCart();
    // Different-seller cart already present → confirm before discarding it.
    if (stored && stored.merchantSlug !== merchantSlug) {
      setConflict({ otherMerchant: stored.merchantSlug });
      return;
    }

    setBusy(true);
    try {
      if (stored?.merchantSlug === merchantSlug) {
        await addCartItem(stored, selected.variantId, quantity);
      } else {
        await createCart(merchantSlug, selected.variantId, quantity);
      }
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sellableVariants.length > 1 ? (
        <label className="text-base-content flex flex-col gap-1.5 text-sm font-medium">
          <span>Option</span>
          <NativeSelect
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setAdded(false);
            }}
          >
            {sellableVariants.map((v) => (
              <option key={v.variantId} value={v.variantId} disabled={!v.inStock}>
                {v.title} — {formatCents(v.priceCents, v.currency || currency)}
                {!v.inStock ? ' (sold out)' : ''}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            color="neutral"
            variant="outline"
            size="md"
            shape="square"
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || busy}
            onClick={() => setQuantity((n) => Math.max(1, n - 1))}
          >
            <Minus size={16} aria-hidden />
          </Button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
          <Button
            type="button"
            color="neutral"
            variant="outline"
            size="md"
            shape="square"
            aria-label="Increase quantity"
            disabled={busy}
            onClick={() => setQuantity((n) => Math.min(99, n + 1))}
          >
            <Plus size={16} aria-hidden />
          </Button>
        </div>

        <Button
          type="button"
          color="primary"
          variant="solid"
          size="lg"
          className="flex-1"
          disabled={!canBuy || busy}
          loading={busy}
          onClick={handleAdd}
          iconStart={added ? <Check size={18} /> : <ShoppingBag size={18} />}
        >
          {!canBuy ? 'Sold out' : added ? 'Added to cart' : 'Add to cart'}
        </Button>
      </div>

      {added ? (
        <Button render={<Link href="/cart" />} color="neutral" variant="soft" size="md">
          View cart
        </Button>
      ) : null}

      {conflict ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>Start a new cart?</AlertTitle>
            <AlertDescription>
              Your cart has items from <strong>{conflict.otherMerchant}</strong>. A sparx.market
              cart can only hold items from one seller at a time. Start a new cart with{' '}
              {merchantName}?
            </AlertDescription>
            <AlertActions>
              <Button
                type="button"
                color="primary"
                variant="solid"
                size="sm"
                disabled={busy}
                loading={busy}
                onClick={() => startNewCart()}
              >
                Start new cart
              </Button>
              <Button
                type="button"
                color="neutral"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConflict(null)}
              >
                Keep current cart
              </Button>
            </AlertActions>
          </AlertContent>
        </Alert>
      ) : null}

      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
