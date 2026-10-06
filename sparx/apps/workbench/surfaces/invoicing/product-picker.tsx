'use client';

// Linking a line to a catalog product.
//
// A billing line can stand alone (a typed description + price) or point at a real
// product version in inventory. Pointing at one seeds the description and unit
// price from the catalog and records the productId / variantId on the line, so
// the invoice ties back to stock, cost and reporting instead of being loose text.
// Picking is a convenience that fills the fields; they stay editable afterwards.
//
// ONE search over every version the site sells, asked of the SERVER as you type:
// the part's name, its code, the version's name or an option value ("6.7L").
// It used to list the first 100 products and filter those in the browser, then
// ask a second question about which version; on a parts counter with 653
// products the code typed into the box found nothing, and a near-identical part
// one digit off got quoted at its own price (sparx persona issue 077). What a
// row and a line say lives in ./product-pick.ts.

import { useState } from 'react';
import { Package, RotateCw } from 'lucide-react';
import { SearchPicker, type PickerRow } from '../../components/search-picker';
import { useProductVariantChoices, useVariantSearch } from '../commerce/bundles-data';
import { pickable, pickerRowFor, pickFrom, type ProductPick } from './product-pick';

export type { ProductPick };

/** Two letters before it asks, the same floor every server search here has. */
const MIN_QUERY = 2;

interface ProductPickerProps {
  productId: string | null;
  variantId?: string | null;
  /** What the line already calls the linked product, when the editor knows. */
  productLabel?: string | null;
  disabled?: boolean;
  onPick: (pick: ProductPick) => void;
  onClear: () => void;
}

export function ProductPicker({
  productId,
  variantId,
  productLabel,
  disabled,
  onPick,
  onClear,
}: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const search = useVariantSearch(query, { enabled: query.trim().length >= MIN_QUERY });
  const found = (search.data ?? []).filter(pickable);

  // The version already on the line, read by its product rather than hoped for
  // in a search window: a line reopened months later must still say what it is.
  const linked = useProductVariantChoices(productId ?? undefined);
  const onLine = (linked.data ?? []).find((variant) => variant.id === variantId);
  const chosen: PickerRow | null = productId
    ? onLine
      ? pickerRowFor(onLine)
      : { id: productId, primary: productLabel ?? 'Linked product', secondary: null }
    : null;

  return (
    <SearchPicker
      chosen={chosen}
      loadingChosen={Boolean(productId) && linked.isPending && !productLabel}
      results={found.map(pickerRowFor)}
      searching={search.searching || search.isPending}
      query={query}
      onQuery={setQuery}
      disabled={disabled}
      label="Search your products"
      placeholder="Search by name or part number…"
      tooShort="Type at least two letters of its name or code."
      // A failed search is not "nothing matches": that sends somebody off to
      // type in by hand a part they stock. It says so, with a way to ask again.
      nothingFound={
        search.isError
          ? 'Your products could not be searched just now.'
          : 'Nothing you sell matches that. Check the code, or type the line in by hand below.'
      }
      {...(search.isError
        ? { nothingFoundAction: { label: () => 'Try again', onAct: search.retry, icon: RotateCw } }
        : {})}
      clearLabel="Choose a different product"
      icon={Package}
      onSelect={(id) => {
        const variant = found.find((candidate) => candidate.id === id);
        if (!variant) return;
        setQuery('');
        onPick(pickFrom(variant));
      }}
      onClear={() => {
        setQuery('');
        onClear();
      }}
    />
  );
}
