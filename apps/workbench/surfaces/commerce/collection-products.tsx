'use client';

// The product picker for a MANUAL collection.
//
// A manual collection is a hand-picked list, so this is the hand doing the
// picking: search the catalog, tick products in, see what is chosen, take some
// back out. The membership is held in the pane's draft and written on the pane's
// one Save (via set-products) — this component owns the SHAPE of the choice, not
// the saving of it, exactly like the product editor's category picker.

import { useMemo, useState } from 'react';
import { useQuery } from '@sparx/query';
import { Badge, Button, Checkbox, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Package, X } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { ProductRow } from './products-data';

export function CollectionProductsEditor({
  collectionId,
  value,
  onChange,
}: {
  /** The collection whose members these are, or null while it does not exist yet
   *  (a brand-new collection — its members are set right after it is created). */
  collectionId: string | null;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  // The current members, fetched so their NAMES can be shown — the draft's ids
  // are authoritative, this is only how they get a label.
  const members = useQuery({
    queryKey: ['commerce', 'products', 'collection-members', collectionId],
    queryFn: () =>
      api.list<ProductRow>('/v1/commerce/products', {
        collection_id: collectionId ?? '',
        include_archived: true,
        take: 250,
      }),
    enabled: Boolean(collectionId),
    staleTime: 60_000,
  });

  // The search window over the catalog, for adding more.
  const found = useQuery({
    queryKey: ['commerce', 'products', 'collection-search', { q: search }],
    queryFn: () =>
      api.list<ProductRow>('/v1/commerce/products', {
        ...(search.trim() ? { q: search.trim() } : {}),
        take: 30,
      }),
    staleTime: 30_000,
  });

  // One name lookup from everything we have seen, so a chosen chip always has a
  // label whether the product came from the member list or a search.
  const nameById = useMemo(() => {
    const map = new Map<string, ProductRow>();
    for (const row of members.data?.items ?? []) map.set(row.id, row);
    for (const row of found.data?.items ?? []) map.set(row.id, row);
    return map;
  }, [members.data, found.data]);

  const results = found.data?.items ?? [];

  const toggle = (id: string, on: boolean) => {
    onChange(on ? [...value, id] : value.filter((existing) => existing !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* What is chosen, always visible, so a product ticked far down the search
          results is still accounted for at a glance. */}
      {value.length === 0 ? (
        <Text>No products chosen yet. Search below and tick the ones that belong here.</Text>
      ) : (
        <div className="flex flex-col gap-2">
          <Text className="font-medium">
            {value.length === 1 ? '1 product chosen' : `${String(value.length)} products chosen`}
          </Text>
          <ul className="flex flex-wrap gap-2">
            {value.map((id) => {
              const row = nameById.get(id);
              return (
                <li key={id}>
                  <span className="border-base-300 flex items-center gap-1 rounded-full border py-1 pr-1 pl-3">
                    <Text as="span">{row?.title ?? 'Product'}</Text>
                    <Button
                      size="xs"
                      shape="circle"
                      variant="ghost"
                      color="neutral"
                      aria-label={`Remove ${row?.title ?? 'product'}`}
                      onClick={() => {
                        toggle(id, false);
                      }}
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="max-w-sm min-w-0">
        <SearchInput
          size="sm"
          aria-label="Search your products"
          placeholder="Search your products…"
          value={search}
          onValueChange={setSearch}
        />
      </div>

      {found.isError ? (
        <Text>Your products could not be searched just now. Try again in a moment.</Text>
      ) : found.isPending ? (
        <Text role="status">Searching…</Text>
      ) : results.length === 0 ? (
        <div className="flex items-center gap-2">
          <Package className="size-5" aria-hidden />
          <Text>
            {search.trim()
              ? `No product matches “${search.trim()}”.`
              : 'Start typing to find products to add.'}
          </Text>
        </div>
      ) : (
        <div className="border-base-300 max-h-72 overflow-y-auto rounded border p-1">
          {results.map((row) => (
            <label
              key={row.id}
              className="hover:bg-base-200 flex cursor-pointer items-center gap-3 rounded px-2 py-2"
            >
              <Checkbox
                color="module"
                checked={value.includes(row.id)}
                aria-label={row.title}
                onChange={(event) => {
                  toggle(row.id, event.target.checked);
                }}
              />
              <span className="min-w-0 flex-1">{row.title}</span>
              {row.status === 'archived' ? (
                <Badge color="neutral" variant="soft" size="sm">
                  Retired
                </Badge>
              ) : row.status === 'draft' ? (
                <Badge color="info" variant="soft" size="sm">
                  Not on sale
                </Badge>
              ) : null}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
