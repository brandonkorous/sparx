'use client';

// A picker over the whole sellable catalog — the shared way a bundle component
// and a configurator add-on both name the exact product version they point at.
//
// Before anybody types it lists the first window of the catalog; once they do,
// the server is asked, so a version past the 500th is as findable as the first
// (sparx persona P01, issue 069: a parts counter with 693 versions). It shows the
// product's name first (that is what a person recognises) and the version +
// price after, and never exposes the raw variant id: the audience owns a shop,
// not a database.

import { useMemo, useState } from 'react';
import { Badge, Button, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faBoxMagnifyingGlass } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { formatCents, stockNoteFor, type VariantStock } from './products-data';
import { useProductVariantChoices, useVariantSearch, type VariantChoice } from './bundles-data';
import { pickerRows } from './variant-search';

/**
 * What tells one version of a product from another, on screen.
 *
 * `title` first when a shop has written one, then the option values, then the
 * code. Nothing at all only for a product with a single unnamed version, where
 * a second line would repeat the first.
 *
 * The option values were already loaded and were never drawn, so searching
 * "slate" returned five rows all reading "The Ash Overshirt · $128.00" and the
 * only way to tell which was the M was to guess (persona issue 221).
 */
export function versionOf(variant: VariantChoice): string {
  if (variant.title) return variant.title;
  const options = variant.options.map((option) => option.value).join(' · ');
  if (options) return options;
  return variant.isDefault ? '' : variant.sku;
}

/**
 * What there is to send, beside the version being considered.
 *
 * FOUR answers, not three, and the fourth is silence. The counts cover one
 * product, so a row for any other product gets no note at all — badging it
 * "Not counted" would report on records nobody read (issue 451).
 *
 * Of the three it does say: a version nobody has counted is NOT zero, because
 * the shop sells it without limit and there is no number to show (issue 444).
 * Zero itself is a real answer and the one that must stop somebody promising it
 * to a customer, so it is the only one that gets a color.
 */
function StockNote({
  variant,
  stock,
}: {
  variant: VariantChoice;
  stock: VariantStock | undefined;
}): React.ReactElement | null {
  const note = stockNoteFor(variant, stock);
  if (note === null) return null;
  switch (note.kind) {
    case 'uncounted':
      return (
        <Badge color="info" variant="soft" size="sm" className="shrink-0">
          Not counted
        </Badge>
      );
    case 'none':
      return (
        <Badge color="danger" variant="soft" size="sm" className="shrink-0">
          None left
        </Badge>
      );
    default:
      return (
        <Text as="span" className="shrink-0 text-sm tabular-nums">
          {note.count} to sell
        </Text>
      );
  }
}

export function VariantPicker({
  onPick,
  excludeIds = [],
  preferProductId,
  stock,
  placeholder = 'Search your products…',
}: {
  onPick: (variant: VariantChoice) => void;
  /** Variant ids already chosen — hidden from the results so they cannot be
   *  added twice. */
  excludeIds?: string[];
  /**
   * One product this pick is ABOUT, floated to the top.
   *
   * Without it the list opens alphabetically over the whole catalog, which for a
   * shop that sells clothes and jewellery meant a knitwear swap opening on
   * signet rings. The obvious answer to "what are you sending instead" is
   * another version of the thing that came back, so it goes first — and the rest
   * of the catalog is still there, because sending something else is allowed
   * (persona issue 450).
   */
  preferProductId?: string;
  /**
   * How many of each version there are to sell, for ONE product. Only passed
   * where the number is part of the decision, and rows outside that product get
   * no note rather than a wrong one (issues 444, 451).
   */
  stock?: VariantStock;
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const catalog = useVariantSearch(search);
  const preferred = useProductVariantChoices(preferProductId);
  const isPending = catalog.isPending || (Boolean(preferProductId) && preferred.isPending);
  const isError = catalog.isError;

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  // "slate" and "medium" are what a person types, and on a catalog with no
  // variant titles they live nowhere but the option values: the same words,
  // the same columns, as the server's search (see variant-search.ts).
  const results = useMemo(
    () =>
      pickerRows({
        found: catalog.data ?? [],
        preferred: preferred.data ?? [],
        preferProductId,
        query: search,
        excluded,
      }),
    [catalog.data, preferred.data, preferProductId, search, excluded]
  );

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
        <div className="flex flex-wrap items-center gap-2">
          <Text className="text-sm">Your products could not be loaded just now.</Text>
          <Button size="sm" variant="outline" onClick={catalog.retry}>
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <Text className="text-sm" role="status">
          Loading your products…
        </Text>
      ) : results.length === 0 && catalog.searching ? (
        // Never "no product matches" while the answer is still on its way: the
        // part may simply be past the rows already in hand.
        <Text className="text-sm" role="status">
          Searching your products…
        </Text>
      ) : results.length === 0 ? (
        <div className="flex items-center gap-2">
          <Icon glyph={faBoxMagnifyingGlass} className="size-5" aria-hidden />
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
                {versionOf(variant) ? (
                  <Text as="span" className="block text-sm">
                    {versionOf(variant)}
                  </Text>
                ) : null}
              </span>
              <StockNote variant={variant} stock={stock} />
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
