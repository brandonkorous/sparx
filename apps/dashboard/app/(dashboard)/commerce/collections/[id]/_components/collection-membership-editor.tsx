'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, GripVertical, Plus, X } from 'lucide-react';

import { statusLabel, statusTone } from '@sparx/ui';
import { Badge, Button, Input } from '@wizeworks/silicaui-react';

import { setCollectionProductsAction } from '../../../collection-actions';

interface ProductBrief {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string | null;
}

interface Props {
  collectionId: string;
  type: 'manual' | 'rules';
  selectedProductIds: string[];
  allProducts: ProductBrief[];
}

// Membership editor for a single collection.
//   • Manual collections: add/remove/reorder products; submit replaces the
//     membership atomically via setProducts.
//   • Rules collections: read-only list of currently-projected products;
//     no add/remove (the indexer worker owns membership).

export function CollectionMembershipEditor({
  collectionId,
  type,
  selectedProductIds,
  allProducts,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState('');
  const [ids, setIds] = React.useState<string[]>(selectedProductIds);

  const productsById = React.useMemo(() => {
    const map = new Map<string, ProductBrief>();
    for (const p of allProducts) map.set(p.id, p);
    return map;
  }, [allProducts]);

  const selectedRows = ids
    .map((id) => productsById.get(id))
    .filter((p): p is ProductBrief => p !== undefined);

  const remaining = allProducts
    .filter((p) => !ids.includes(p.id))
    .filter((p) =>
      filter.length === 0
        ? true
        : `${p.title} ${p.handle} ${p.vendor ?? ''}`.toLowerCase().includes(filter.toLowerCase())
    )
    .slice(0, 100);

  function add(productId: string) {
    setIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
  }
  function remove(productId: string) {
    setIds((prev) => prev.filter((id) => id !== productId));
  }
  function move(productId: string, direction: -1 | 1) {
    setIds((prev) => {
      const idx = prev.indexOf(productId);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  }

  function save() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await setCollectionProductsAction({
        collectionId,
        productIds: ids,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  if (type === 'rules') {
    return (
      <div className="flex flex-col gap-3">
        {selectedRows.length === 0 ? (
          <div className="border-base-300 flex flex-col items-center gap-2 rounded border border-dashed p-6 text-center">
            <p className="text-base-content text-sm">
              The rule hasn&apos;t projected any products yet. The indexer worker re-evaluates on
              its next tick (Phase 1.5).
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {selectedRows.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">In this collection ({selectedRows.length})</p>
        {selectedRows.length === 0 ? (
          <div className="border-base-300 flex flex-col items-center gap-1 rounded border border-dashed p-6 text-center">
            <p className="text-base-content text-sm">Add products from the picker below.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {selectedRows.map((p, idx) => (
              <div
                key={p.id}
                className="border-base-300 bg-base-100 flex flex-row items-center gap-2 rounded border px-3 py-2"
              >
                <GripVertical className="text-base-content h-4 w-4" aria-hidden />
                <div className="flex flex-1 flex-col gap-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-base-content text-xs">
                    /{p.handle}
                    {p.vendor ? ` · ${p.vendor}` : ''}
                  </p>
                </div>
                <Badge color={statusTone(p.status)} variant="soft" size="sm">
                  {statusLabel(p.status)}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(p.id, -1)}
                  disabled={pending || idx === 0}
                  aria-label={`Move ${p.title} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(p.id, 1)}
                  disabled={pending || idx === selectedRows.length - 1}
                  aria-label={`Move ${p.title} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(p.id)}
                  disabled={pending}
                  iconStart={<X className="h-3.5 w-3.5" />}
                  aria-label={`Remove ${p.title}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Add products</p>
        <Input
          placeholder="Filter by title, handle, or vendor"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {remaining.length === 0 ? (
          <p className="text-base-content text-sm">
            {allProducts.length === selectedRows.length
              ? 'Every product is already in this collection.'
              : 'No matches.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {remaining.map((p) => (
              <div
                key={p.id}
                className="border-base-300 bg-base-200 flex flex-row items-center gap-2 rounded border px-3 py-2"
              >
                <div className="flex flex-1 flex-col gap-0">
                  <p className="text-sm">{p.title}</p>
                  <p className="text-base-content text-xs">
                    /{p.handle}
                    {p.vendor ? ` · ${p.vendor}` : ''}
                  </p>
                </div>
                <Badge color={statusTone(p.status)} variant="soft" size="sm">
                  {statusLabel(p.status)}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => add(p.id)}
                  disabled={pending}
                  iconStart={<Plus className="h-3.5 w-3.5" />}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-danger text-sm" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <div className="flex flex-row items-center justify-end gap-2">
        {savedAt !== null && (
          <div className="text-success flex flex-row items-center gap-1">
            <Check className="h-4 w-4" />
            <p className="text-success text-sm">Saved</p>
          </div>
        )}
        <Button type="button" color="module" onClick={save} disabled={pending} loading={pending}>
          Save membership
        </Button>
      </div>
    </div>
  );
}

function ProductRow({ product }: { product: ProductBrief }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-row items-center gap-2 rounded border px-3 py-2">
      <div className="flex flex-1 flex-col gap-0">
        <p className="text-sm font-medium">{product.title}</p>
        <p className="text-base-content text-xs">
          /{product.handle}
          {product.vendor ? ` · ${product.vendor}` : ''}
        </p>
      </div>
      <Badge color={statusTone(product.status)} variant="soft" size="sm">
        {statusLabel(product.status)}
      </Badge>
    </div>
  );
}
