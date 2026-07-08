'use client';

// The tenant's products currently listed on sparx.market — one row each, with an
// inline category change and a per-row Remove (un-list). Removing a single product
// is destructive (it drops the public listing), so it goes behind useConfirm
// naming the product. A CTA links back to the products list for listing more.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { marketCategoryLabel, MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Badge, Button, EmptyState, Select, Table } from 'silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { setProductListedAction } from '../actions';
import { formatMoney } from '../_format';
import type { MarketListedProduct } from '../_types';

// Value→label map that powers the category Select's trigger label + options.
const CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  MARKET_CATEGORIES.map((c) => [c.slug, c.name])
);

function priceLabel(cents: number | null): string {
  return cents == null ? '—' : `from ${formatMoney(cents)}`;
}

function ProductRow({ product }: { product: MarketListedProduct }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onCategoryChange(category: string) {
    startTransition(async () => {
      const res = await setProductListedAction(product.productId, { listed: true, category });
      if (!res.ok) {
        toast.error('Could not update category', { description: res.error.message });
        return;
      }
      toast.success('Category updated', {
        description: `${product.title} moved to ${marketCategoryLabel(category)}.`,
      });
      router.refresh();
    });
  }

  async function onRemove() {
    const ok = await confirm({
      title: `Remove ${product.title}?`,
      description:
        'This un-lists the product from sparx.market — it disappears from the marketplace immediately. Your product itself is untouched, and you can re-list it any time.',
      confirmLabel: 'Remove from sparx.market',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setProductListedAction(product.productId, { listed: false });
      if (!res.ok) {
        toast.error('Could not remove product', { description: res.error.message });
        return;
      }
      toast.success('Removed from sparx.market', { description: product.title });
      router.refresh();
    });
  }

  return (
    <tr>
      <td>
        <div className="flex flex-col gap-1">
          <Link
            href={`/commerce/products/${product.productId}`}
            className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
          >
            {product.title}
          </Link>
          <p className="text-base-content/70 text-xs">/{product.handle}</p>
        </div>
      </td>
      <td>
        <Select
          value={product.category ?? 'general'}
          onValueChange={(v) => onCategoryChange(v as string)}
          disabled={pending}
          size="sm"
          className="w-[12rem]"
          aria-label={`Category for ${product.title}`}
          items={CATEGORY_ITEMS}
        />
      </td>
      <td>
        <div className="flex flex-row flex-wrap items-center gap-2">
          {product.featured && (
            <Badge color="module" variant="soft" size="sm">
              Featured
            </Badge>
          )}
          <Badge color={product.approved ? 'success' : 'warning'} variant="soft" size="sm">
            {product.approved ? 'Approved' : 'In review'}
          </Badge>
          <Badge color={product.inStock ? 'success' : 'neutral'} variant="soft" size="sm">
            {product.inStock ? 'In stock' : 'Out of stock'}
          </Badge>
        </div>
      </td>
      <td className="text-right whitespace-nowrap">
        <p className="text-base-content/70 text-sm">{priceLabel(product.priceMinCents)}</p>
      </td>
      <td className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => void onRemove()}
          aria-label={`Remove ${product.title} from sparx.market`}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}

export function ListedProductsTable({
  products,
  total,
}: {
  products: MarketListedProduct[];
  total: number;
}) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products listed yet"
        description="List products on sparx.market from your product catalog — open a product and flip on “List on sparx.market”, or select several from the products list and use the bulk action."
        actions={
          <Button color="module" render={<Link href="/commerce/products" />}>
            Go to products
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <p className="text-base-content/70 text-sm">
          {total.toLocaleString()} product{total === 1 ? '' : 's'} listed
          {total > products.length ? ` · showing ${products.length}` : ''}
        </p>
        <Button variant="soft" color="module" size="sm" render={<Link href="/commerce/products" />}>
          List more products
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Status</th>
            <th className="text-right">Price</th>
            <th className="sr-only text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ProductRow key={p.productId} product={p} />
          ))}
        </tbody>
      </Table>
    </div>
  );
}
