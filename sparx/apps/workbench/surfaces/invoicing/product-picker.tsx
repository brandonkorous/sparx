'use client';

// Linking a line to a catalog product.
//
// A billing line can stand alone (a typed description + price) or point at a real
// product in inventory. Pointing at one seeds the description and unit price from
// the catalog and records the productId / variantId on the line — so the invoice
// ties back to stock, cost, and reporting instead of being loose text. Picking is
// a convenience that fills the fields; they stay editable afterwards.
//
// Two levels: a product, then — only when the product has more than one variant —
// the specific variant, because that is what carries the real price and cost. A
// single-variant product needs no second choice.
//
// The list is the Combobox's own client-side filter over a bounded fetch (Base UI
// filters the items it is given; there is no async-search hook). For a catalog
// bigger than that fetch we say so plainly rather than pretend the list is whole —
// a silent cap reads as "this product doesn't exist."

import { useMemo, useState } from 'react';
import { useQuery } from '@wizeworks/query';
import { Button, Combobox, Text } from '@wizeworks/silicaui-react';
import { X } from 'lucide-react';
import { api } from '../../lib/api/client';
import { formatMoney } from './types';

interface ProductListItem {
  id: string;
  title: string;
  priceMinCents: number;
  priceMaxCents: number;
  variantCount: number;
  vendor: string | null;
}

interface VariantItem {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
}

export interface ProductPick {
  productId: string;
  variantId: string | null;
  description: string;
  /** Dollars — seeds the line's unit price. */
  unitPrice: number;
}

interface Option {
  value: string;
  label: string;
  product: ProductListItem;
}

const FETCH_LIMIT = 100;

interface ProductPickerProps {
  productId: string | null;
  variantId?: string | null;
  /** A label to show for an already-linked product not in the fetched page. */
  productLabel?: string | null;
  currency: string;
  disabled?: boolean;
  onPick: (pick: ProductPick) => void;
  onClear: () => void;
}

export function ProductPicker({
  productId,
  variantId,
  productLabel,
  currency,
  disabled,
  onPick,
  onClear,
}: ProductPickerProps) {
  // The product whose variants we're choosing among — held locally so a
  // multi-variant pick is a two-step without committing an incomplete line.
  const [activeProductId, setActiveProductId] = useState<string | null>(productId);

  const { data, isLoading } = useQuery({
    queryKey: ['commerce', 'products', 'picker'],
    queryFn: () =>
      api.list<ProductListItem>('/v1/commerce/products', { take: FETCH_LIMIT, status: 'active' }),
    staleTime: 60_000,
  });

  // MEMOISED — a fresh `?? []` each render would re-key the options memo (and
  // the Combobox effect) every time, looping "Maximum update depth exceeded".
  const products = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;

  const options: Option[] = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.vendor ? `${product.title} · ${product.vendor}` : product.title,
        product,
      })),
    [products]
  );

  const selected = useMemo(() => {
    const match = options.find((option) => option.value === productId);
    if (match) return match;
    // Linked to a product outside the fetched page — show what we know so the
    // field isn't blank on an existing line.
    if (productId) {
      return {
        value: productId,
        label: productLabel ?? 'Linked product',
        product: null,
      } as unknown as Option;
    }
    return null;
  }, [options, productId, productLabel]);

  const activeProduct = products.find((p) => p.id === activeProductId);
  const needsVariant = (activeProduct?.variantCount ?? 0) > 1;

  const { data: variants } = useQuery({
    queryKey: ['commerce', 'variants', activeProductId],
    queryFn: () =>
      api.get<VariantItem[]>(`/v1/commerce/products/${activeProductId ?? ''}/variants`),
    enabled: Boolean(activeProductId) && needsVariant,
    staleTime: 60_000,
  });

  const variantOptions = useMemo(
    () =>
      (variants ?? []).map((variant) => ({
        value: variant.id,
        label: `${variant.title ?? variant.sku} · ${formatMoney(variant.priceCents / 100, currency)}`,
        variant,
      })),
    [variants, currency]
  );

  const selectedVariant = useMemo(
    () => variantOptions.find((option) => option.value === variantId) ?? null,
    [variantOptions, variantId]
  );

  function pickProduct(product: ProductListItem) {
    setActiveProductId(product.id);
    // A single-variant product is complete on the spot — seed from the product.
    // A multi-variant one waits for the variant choice below before it prices.
    if (product.variantCount > 1) return;
    onPick({
      productId: product.id,
      variantId: null,
      description: product.title,
      unitPrice: product.priceMinCents / 100,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            color="module"
            items={options}
            value={selected}
            disabled={disabled ?? isLoading}
            placeholder={isLoading ? 'Loading products…' : 'Search products…'}
            emptyMessage="No product matches that."
            aria-label="Product"
            clearable={false}
            onValueChange={(next) => {
              if (!next) return;
              pickProduct((next as Option).product);
            }}
          />
        </div>
        {productId ? (
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            shape="square"
            disabled={disabled}
            aria-label="Unlink product"
            onClick={() => {
              setActiveProductId(null);
              onClear();
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      {needsVariant ? (
        <Combobox
          color="module"
          items={variantOptions}
          value={selectedVariant}
          disabled={disabled}
          placeholder="Choose a variant…"
          emptyMessage="No variants found."
          aria-label="Variant"
          clearable={false}
          onValueChange={(next) => {
            if (!next || !activeProduct) return;
            const option = next as { value: string; variant: VariantItem };
            onPick({
              productId: activeProduct.id,
              variantId: option.variant.id,
              description: `${activeProduct.title} — ${option.variant.title ?? option.variant.sku}`,
              unitPrice: option.variant.priceCents / 100,
            });
          }}
        />
      ) : null}

      {total > products.length ? (
        <Text className="text-sm">
          Showing {products.length} of {total} products — refine your search, or open the full
          catalog in Selling.
        </Text>
      ) : null}
    </div>
  );
}
