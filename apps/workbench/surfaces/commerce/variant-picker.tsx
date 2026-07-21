'use client';

// A picker over the whole sellable catalog — the shared way a bundle component
// and a configurator add-on both name the exact product version they point at.
//
// The tenant-wide variants endpoint has no search of its own, so this loads a
// window once and filters it here as you type. It shows the product's name first
// (that is what a person recognises) and the version + price after, and never
// exposes the raw variant id — the audience owns a shop, not a database.

import { useMemo, useState } from 'react';
import { Badge, SearchInput, Text } from '@wizeworks/silicaui-react';
import { PackageSearch } from 'lucide-react';
import { formatCents } from './products-data';
import { useVariantCatalog, type VariantChoice } from './bundles-data';

export function VariantPicker({
  onPick,
  excludeIds = [],
  placeholder = 'Search your products…',
}: {
  onPick: (variant: VariantChoice) => void;
  /** Variant ids already chosen — hidden from the results so they cannot be
   *  added twice. */
  excludeIds?: string[];
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const { data, isPending, isError } = useVariantCatalog();

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const results = useMemo(() => {
    const all = data ?? [];
    const term = search.trim().toLowerCase();
    return all
      .filter((v) => !excluded.has(v.id))
      .filter((v) => {
        if (term === '') return true;
        return (
          v.productTitle.toLowerCase().includes(term) ||
          v.sku.toLowerCase().includes(term) ||
          (v.title?.toLowerCase().includes(term) ?? false)
        );
      })
      .slice(0, 40);
  }, [data, search, excluded]);

  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-sm min-w-0">
        <SearchInput
          size="sm"
          aria-label="Search your products"
          placeholder={placeholder}
          value={search}
          onValueChange={setSearch}
        />
      </div>

      {isError ? (
        <Text className="text-sm">Your products could not be loaded just now. Try again in a moment.</Text>
      ) : isPending ? (
        <Text className="text-sm" role="status">
          Loading your products…
        </Text>
      ) : results.length === 0 ? (
        <div className="flex items-center gap-2">
          <PackageSearch className="size-5" aria-hidden />
          <Text className="text-sm">
            {search.trim()
              ? `No product matches “${search.trim()}”.`
              : 'No products to choose from yet.'}
          </Text>
        </div>
      ) : (
        <div className="border-base-300 max-h-72 overflow-y-auto rounded border p-1">
          {results.map((variant) => (
            <button
              key={variant.id}
              type="button"
              className="hover:bg-base-200 flex w-full items-center gap-3 rounded px-2 py-2 text-left"
              onClick={() => {
                onPick(variant);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{variant.productTitle}</span>
                {!variant.isDefault && variant.title ? (
                  <Text as="span" className="block text-sm">
                    {variant.title}
                  </Text>
                ) : null}
              </span>
              <Text as="span" className="shrink-0 text-sm tabular-nums">
                {formatCents(variant.priceCents, variant.currency)}
              </Text>
              {variant.productStatus === 'draft' ? (
                <Badge color="info" variant="soft" size="sm">
                  Not on sale
                </Badge>
              ) : variant.productStatus === 'archived' ? (
                <Badge color="neutral" variant="soft" size="sm">
                  Retired
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
