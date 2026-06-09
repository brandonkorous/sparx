// Dropship products — all commerce products that were imported from a supplier.
// Fetches from /v1/dropship/suppliers (all) → /v1/dropship/suppliers/:id/catalog (imported only).
// NOTE: this page will be replaced by a proper /v1/dropship/products endpoint in Ph3.

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ExternalLink, Package } from 'lucide-react';
import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';

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

function calcMarginPct(costCents: number, msrpCents: number | null): string | null {
  if (!msrpCents || msrpCents <= costCents) return null;
  return (((msrpCents - costCents) / msrpCents) * 100).toFixed(1);
}

const LINK_STATUS: Record<string, { color: 'success' | 'warning' | 'neutral'; label: string }> = {
  active: { color: 'success', label: 'Active' },
  discontinued: { color: 'warning', label: 'Discontinued' },
};

export default async function DropshipProductsPage() {
  const { data: suppliers } = await api.getPaged<Supplier[]>('/v1/dropship/suppliers?take=100');

  const productsBySupplier: { supplier: Supplier; products: DropshipProduct[] }[] = [];

  await Promise.all(
    suppliers.map(async (supplier) => {
      const { data: products } = await api.getPaged<DropshipProduct[]>(
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
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Package className="h-5 w-5" />}
          title="Dropship products"
          badge={
            <Badge color="module" variant="soft">
              {totalImported} imported
            </Badge>
          }
          description={`${totalImported} products imported from ${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`}
        />

        <ListToolbar searchPlaceholder="Search products…" />

        {totalImported === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No products imported yet"
              description="Browse a supplier's catalog and import products to see them here."
              action={
                <Link href="/dropship/suppliers">
                  <Button color="module" variant="soft">
                    Browse suppliers
                  </Button>
                </Link>
              }
            />
          </Card>
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
                        <th className="px-4 py-3 text-left font-medium">Margin</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {products.map((p) => {
                        const margin = calcMarginPct(p.costPriceCents, p.msrpCents);
                        const linkStatus = p.links[0]?.status;
                        const statusMeta = linkStatus
                          ? (LINK_STATUS[linkStatus] ?? {
                              color: 'neutral' as const,
                              label: linkStatus,
                            })
                          : null;
                        return (
                          <tr key={p.id} className="hover:bg-[var(--color-muted)]">
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
                              {margin !== null ? (
                                <Badge
                                  color={
                                    Number(margin) >= 20
                                      ? 'success'
                                      : Number(margin) >= 10
                                        ? 'warning'
                                        : 'neutral'
                                  }
                                  variant="soft"
                                  size="sm"
                                >
                                  {margin}%
                                </Badge>
                              ) : (
                                <Text size="sm" className="text-[var(--color-muted-foreground)]">
                                  —
                                </Text>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {statusMeta ? (
                                <Badge color={statusMeta.color} variant="soft" size="sm">
                                  {statusMeta.label}
                                </Badge>
                              ) : (
                                <Badge color="success" variant="soft" size="sm">
                                  Active
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
