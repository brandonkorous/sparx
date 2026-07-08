'use client';

// The product's sparx.market opt-in (docs/106 §4.7) — list this product on the
// first-party marketplace and pick its category. Writes via
// PUT /v1/market/products/:productId. sparx.market is part of Commerce, so this
// panel inherits the Commerce-orange tint from the product detail's
// ModuleProvider (no nested provider). Explicit save, dirty-gated.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardBody,
  Label,
  Select,
  Switch,
} from 'silicaui-react';

import { setProductMarketStateAction } from '../../../product-actions';

interface Props {
  productId: string;
  /** Whether the tenant has joined sparx.market at all (gates listing). */
  marketEnabled: boolean;
  initialListed: boolean;
  initialCategory: string | null;
}

export function ProductMarketPanel({
  productId,
  marketEnabled,
  initialListed,
  initialCategory,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const [listed, setListed] = React.useState(initialListed);
  const [category, setCategory] = React.useState(initialCategory ?? 'general');

  const dirty = listed !== initialListed || (listed && category !== (initialCategory ?? 'general'));

  function field<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setError(null);
      setSavedAt(null);
    };
  }

  function onSave() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const res = await setProductMarketStateAction(productId, {
        listed,
        ...(listed ? { category } : {}),
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <h2 className="text-xl font-semibold">sparx.market</h2>
        <p className="opacity-70">
          List this product on the first-party marketplace so shoppers across the sparx network can
          discover and buy it.
        </p>
        <div className="flex flex-col gap-4">
          {!marketEnabled && (
            <Alert color="info" variant="soft">
              <AlertContent>
                <AlertTitle>Join sparx.market first</AlertTitle>
                <AlertDescription>
                  Your store isn’t selling on sparx.market yet. Enable it in{' '}
                  <Link
                    href="/commerce/market"
                    className="font-medium text-[var(--module-active)] hover:underline"
                  >
                    Commerce → sparx.market
                  </Link>{' '}
                  to list products.
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <div className="flex flex-row flex-wrap items-center gap-3">
            <Switch
              checked={listed}
              disabled={pending || !marketEnabled}
              onCheckedChange={(v) => field(setListed)(v)}
              aria-label="List on sparx.market"
            />
            <div className="flex flex-col gap-0">
              <Label>List on sparx.market</Label>
              <p className="text-base-content/70 text-xs">
                {listed ? 'Visible on the marketplace.' : 'Not listed on the marketplace.'}
              </p>
            </div>
          </div>

          {listed && (
            <div className="flex max-w-xs flex-col gap-2">
              <Label htmlFor="market-product-category">Category</Label>
              <Select
                id="market-product-category"
                value={category}
                onValueChange={(v) => field(setCategory)(v as string)}
                disabled={pending}
                items={Object.fromEntries(MARKET_CATEGORIES.map((c) => [c.slug, c.name]))}
              />
              <p className="text-base-content/70 text-xs">
                Which marketplace aisle this product appears in.
              </p>
            </div>
          )}

          <div className="flex flex-row flex-wrap items-center justify-end gap-3">
            {error && (
              <p className="text-danger mr-auto text-sm" role="alert" aria-live="polite">
                {error}
              </p>
            )}
            {savedAt !== null && !dirty && (
              <div className="flex flex-row items-center gap-1 text-[var(--color-success-text)]">
                <Check className="h-4 w-4" />
                <p className="text-success text-sm">Saved</p>
              </div>
            )}
            <Button
              type="button"
              color="module"
              disabled={pending || !dirty || (listed && !marketEnabled)}
              loading={pending}
              onClick={onSave}
            >
              Save
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
