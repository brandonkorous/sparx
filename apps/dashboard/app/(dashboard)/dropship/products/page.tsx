// Dropship products — all commerce products that were imported from a supplier.
// Fetches from /v1/dropship/suppliers (all) → /v1/dropship/suppliers/:id/catalog (imported only).
// Simpler: query dropship_product_links via GET /v1/dropship/products once that
// endpoint exists in Ph3. For Ph2 we aggregate from the suppliers list + link data.
//
// NOTE: this page will be replaced by a proper /v1/dropship/products endpoint in Ph3.

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Stack, Text, Badge, Button } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { ExternalLink } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  type: string;
}

interface DropshipProduct {
  id: string;
  supplierProductId: string;
  title: string;
  images: string[];
  costPriceCents: number;
  msrpCents: number | null;
  isImported: boolean;
  links: { id: string; productId: string; status: string }[];
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function DropshipProductsPage() {
  const { data: suppliers } = await api.getPaged<Supplier>('/v1/dropship/suppliers?take=100');

  // For each supplier fetch imported products (isImported=true).
  const productsBySupplier: Array<{ supplier: Supplier; products: DropshipProduct[] }> = [];

  await Promise.all(
    suppliers.map(async (supplier) => {
      const { data: products } = await api.getPaged<DropshipProduct>(
        `/v1/dropship/suppliers/${supplier.id}/catalog?take=250`
      );
      const imported = products.filter((p) => p.isImported);
      if (imported.length > 0) {
        productsBySupplier.push({ supplier, products: imported });
      }
    })
  );

  const totalImported = productsBySupplier.reduce((sum, g) => sum + g.products.length, 0);

  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Text size="xl" className="font-semibold">
          Dropship products
        </Text>
        <Text size="sm" className="text-[var(--color-muted-foreground)]">
          {totalImported} products imported from {suppliers.length} supplier
          {suppliers.length !== 1 ? 's' : ''}
        </Text>
      </Stack>

      {totalImported === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center">
          <Text className="mb-1 font-medium">No products imported yet</Text>
          <Text size="sm" className="mb-4 text-[var(--color-muted-foreground)]">
            Browse a supplier's catalog and import products to see them here.
          </Text>
          <Link href="/dropship/suppliers">
            <Button color="primary" variant="soft">
              Browse suppliers
            </Button>
          </Link>
        </div>
      ) : (
        <Stack gap={8}>
          {productsBySupplier.map(({ supplier, products }) => (
            <Stack key={supplier.id} gap={3}>
              <Stack direction="row" gap={2} className="items-center">
                <Text className="font-semibold">{supplier.name}</Text>
                <Badge color="neutral" variant="soft" size="sm">
                  {products.length} products
                </Badge>
                <Link
                  href={`/dropship/suppliers/${supplier.id}/catalog`}
                  className="ml-auto flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  Browse catalog <ExternalLink className="h-3 w-3" />
                </Link>
              </Stack>
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-left font-medium">Supplier ID</th>
                      <th className="px-4 py-3 text-left font-medium">Cost</th>
                      <th className="px-4 py-3 text-left font-medium">MSRP</th>
                      <th className="px-4 py-3 text-left font-medium">Catalog link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--color-muted/50)]">
                        <td className="px-4 py-3">
                          <Stack direction="row" gap={3} className="items-center">
                            {p.images[0] ? (
                              <img
                                src={p.images[0]}
                                alt={p.title}
                                className="h-9 w-9 flex-shrink-0 rounded bg-[var(--color-muted)] object-cover"
                              />
                            ) : (
                              <div className="h-9 w-9 flex-shrink-0 rounded bg-[var(--color-muted)]" />
                            )}
                            <Stack gap={0}>
                              <Text className="line-clamp-1 font-medium">{p.title}</Text>
                              {p.links[0] && (
                                <Link
                                  href={`/commerce/products/${p.links[0].productId}`}
                                  className="text-xs text-[var(--color-muted-foreground)] hover:underline"
                                >
                                  View in catalog →
                                </Link>
                              )}
                            </Stack>
                          </Stack>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                          {p.supplierProductId}
                        </td>
                        <td className="px-4 py-3">
                          {p.costPriceCents > 0 ? formatCents(p.costPriceCents) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {p.msrpCents ? formatCents(p.msrpCents) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color="success" variant="soft" size="sm">
                            Imported
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
