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
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Switch,
  Text,
} from '@sparx/ui';

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
    <Card variant="module">
      <CardHeader>
        <Heading level={3} as="h2">
          sparx.market
        </Heading>
        <CardDescription>
          List this product on the first-party marketplace so shoppers across the sparx network can
          discover and buy it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          {!marketEnabled && (
            <Alert color="info" variant="soft" title="Join sparx.market first">
              Your store isn’t selling on sparx.market yet. Enable it in{' '}
              <Link
                href="/settings/market"
                className="font-medium text-[var(--module-active)] hover:underline"
              >
                Settings → sparx.market
              </Link>{' '}
              to list products.
            </Alert>
          )}

          <Stack direction="row" align="center" gap={3} wrap>
            <Switch
              checked={listed}
              disabled={pending || !marketEnabled}
              onCheckedChange={(v) => field(setListed)(v)}
              aria-label="List on sparx.market"
            />
            <Stack gap={0}>
              <Label>List on sparx.market</Label>
              <Text size="xs" variant="muted">
                {listed ? 'Visible on the marketplace.' : 'Not listed on the marketplace.'}
              </Text>
            </Stack>
          </Stack>

          {listed && (
            <Stack gap={2} className="max-w-xs">
              <Label htmlFor="market-product-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => field(setCategory)(v)}
                disabled={pending}
              >
                <SelectTrigger id="market-product-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKET_CATEGORIES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Text size="xs" variant="muted">
                Which marketplace aisle this product appears in.
              </Text>
            </Stack>
          )}

          <Stack direction="row" align="center" justify="end" gap={3} wrap>
            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mr-auto">
                {error}
              </Text>
            )}
            {savedAt !== null && !dirty && (
              <Stack
                direction="row"
                align="center"
                gap={1}
                className="text-[var(--color-success-text)]"
              >
                <Check className="h-4 w-4" />
                <Text size="sm" variant="success">
                  Saved
                </Text>
              </Stack>
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
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
