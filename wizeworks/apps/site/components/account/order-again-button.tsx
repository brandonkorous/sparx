'use client';

// "Order again" and a saved cart's "Add to cart" (sparx persona issue 086). Both
// fill the shopper's cart ON THE SERVER through the ordinary add-to-cart, so
// every line is priced today for their account and the account's quantity rules
// and stock apply. This makes sure a cart exists, runs the fill, refreshes the
// cart badge, and says what happened right where the button was pressed.
// A basket already bought is swapped for a fresh one first, so "Order again"
// straight after an order fills a new basket instead of refusing.

import { useState } from 'react';

import { Alert, Button, type ButtonProps } from '@wizeworks/silicaui-react';

import { useCart } from '@/components/cart-provider';
import { AccountError, type RefillResult } from '@/lib/customer-client';
import { RefillReport } from './refill-report';

export function FillCartButton({
  label,
  busyLabel,
  run,
  size,
  variant,
}: {
  label: string;
  busyLabel: string;
  run: (cartId: string) => Promise<RefillResult>;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}) {
  const { fillCart, refresh } = useCart();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RefillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Through `fillCart`, which starts a fresh basket when the one this
      // browser held was already bought (sparx persona issue 087).
      const filled = await fillCart(run);
      await refresh();
      setResult(filled);
    } catch (err) {
      // A refusal the buyer can act on (a role that cannot order, an order that
      // is not theirs) says so; anything else is a failure to try again.
      setError(
        err instanceof AccountError && err.status < 500
          ? err.message
          : 'Nothing was added to your cart. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          type="button"
          color="primary"
          size={size}
          variant={variant}
          disabled={busy}
          onClick={() => void handle()}
        >
          {busy ? busyLabel : label}
        </Button>
      </div>
      {error && (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      )}
      {result && <RefillReport result={result} onDismiss={() => setResult(null)} />}
    </div>
  );
}
