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
import {
  Badge,
  Button,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import { setProductListedAction } from '../actions';
import { formatMoney } from '../_format';
import type { MarketListedProduct } from '../_types';

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
    <TableRow>
      <TableCell>
        <Stack gap={1}>
          <Link
            href={`/commerce/products/${product.productId}`}
            className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
          >
            {product.title}
          </Link>
          <Text size="xs" variant="muted">
            /{product.handle}
          </Text>
        </Stack>
      </TableCell>
      <TableCell>
        <Select
          value={product.category ?? 'general'}
          onValueChange={onCategoryChange}
          disabled={pending}
        >
          <SelectTrigger
            size="sm"
            className="w-[12rem]"
            aria-label={`Category for ${product.title}`}
          >
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
      </TableCell>
      <TableCell>
        <Stack direction="row" align="center" gap={2} wrap>
          {product.featured && (
            <Badge color="commerce" variant="soft" size="sm">
              Featured
            </Badge>
          )}
          <Badge color={product.approved ? 'success' : 'warning'} variant="soft" size="sm">
            {product.approved ? 'Approved' : 'In review'}
          </Badge>
          <Badge color={product.inStock ? 'success' : 'neutral'} variant="soft" size="sm">
            {product.inStock ? 'In stock' : 'Out of stock'}
          </Badge>
        </Stack>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Text size="sm" variant="muted">
          {priceLabel(product.priceMinCents)}
        </Text>
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
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
        action={
          <Button asChild color="module">
            <Link href="/commerce/products">Go to products</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Stack gap={3}>
      <Stack direction="row" align="center" justify="between" gap={2} wrap>
        <Text size="sm" variant="muted">
          {total.toLocaleString()} product{total === 1 ? '' : 's'} listed
          {total > products.length ? ` · showing ${products.length}` : ''}
        </Text>
        <Button asChild variant="soft" color="module" size="sm">
          <Link href="/commerce/products">
            List more products
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </Stack>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="sr-only text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <ProductRow key={p.productId} product={p} />
            ))}
          </TableBody>
        </Table>
      </div>
    </Stack>
  );
}
