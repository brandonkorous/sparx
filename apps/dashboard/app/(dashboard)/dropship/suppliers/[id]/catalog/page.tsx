export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../../../_components/list-toolbar';
import { ImportButton } from './_components/import-button';
import { SyncButton } from './_components/sync-button';
import { notFound } from 'next/navigation';

interface DropshipProduct {
  id: string;
  supplierProductId: string;
  title: string;
  description: string | null;
  images: string[];
  variants: {
    supplierSku: string;
    costPriceCents: number;
    msrpCents: number | null;
    inventoryQuantity: number | null;
  }[];
  costPriceCents: number;
  msrpCents: number | null;
  isImported: boolean;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  status: string;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; skip?: string }>;
}

export default async function SupplierCatalogPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { q, skip: skipStr } = await searchParams;
  const skip = parseInt(skipStr ?? '0', 10) || 0;
  const take = 50;

  let supplier: Supplier;
  let products: DropshipProduct[];
  let total: number;

  try {
    supplier = await api.get<Supplier>(`/v1/dropship/suppliers/${id}`);
    const qs = new URLSearchParams({ take: String(take), skip: String(skip) });
    if (q) qs.set('q', q);
    const result = await api.getPaged<DropshipProduct[]>(
      `/v1/dropship/suppliers/${id}/catalog?${qs}`
    );
    products = result.data;
    total = (result.meta?.total as number | undefined) ?? 0;
  } catch {
    notFound();
  }

  const prevSkip = Math.max(0, skip - take);
  const nextSkip = skip + take;
  const qParam = q ? `&q=${encodeURIComponent(q)}` : '';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <Link
          href="/dropship/suppliers"
          className="flex w-fit items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ChevronLeft className="h-4 w-4" /> Suppliers
        </Link>

        <PageHeader
          title={`${supplier.name} — Catalog`}
          badge={
            <Badge color="neutral" variant="soft">
              {total} products
            </Badge>
          }
          description="Browse and import products into your catalog."
          actions={<SyncButton supplierId={id} />}
        />

        <ListToolbar searchPlaceholder="Search products…" />

        {products.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title={q ? `No products match "${q}"` : 'No catalog entries yet'}
              description={
                q
                  ? 'Try a different search term or clear the filter.'
                  : 'Trigger a catalog sync to pull products from this supplier.'
              }
            />
          </Card>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Product</th>
                    <th className="px-4 py-3 text-left font-medium">Supplier ID</th>
                    <th className="px-4 py-3 text-left font-medium">Variants</th>
                    <th className="px-4 py-3 text-left font-medium">Cost</th>
                    <th className="px-4 py-3 text-left font-medium">MSRP</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--color-muted)]">
                      <td className="px-4 py-3">
                        <Stack direction="row" gap={3} className="items-center">
                          {p.images[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.title}
                              className="h-10 w-10 flex-shrink-0 rounded bg-[var(--color-muted)] object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 flex-shrink-0 rounded bg-[var(--color-muted)]" />
                          )}
                          <Text className="line-clamp-1 font-medium">{p.title}</Text>
                        </Stack>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                        {p.supplierProductId}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {p.variants.length}
                      </td>
                      <td className="px-4 py-3">
                        {p.costPriceCents > 0 ? formatCents(p.costPriceCents) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {p.msrpCents ? formatCents(p.msrpCents) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {p.isImported ? (
                          <Badge color="success" variant="soft" size="sm">
                            Imported
                          </Badge>
                        ) : (
                          <Badge color="neutral" variant="soft" size="sm">
                            Not imported
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ImportButton supplierId={id} productId={p.id} isImported={p.isImported} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > take && (
              <Stack direction="row" gap={2} className="items-center justify-end">
                <Text size="sm" className="text-[var(--color-muted-foreground)]">
                  {skip + 1}–{Math.min(skip + take, total)} of {total}
                </Text>
                {skip > 0 && (
                  <Link href={`/dropship/suppliers/${id}/catalog?skip=${prevSkip}${qParam}`}>
                    <Button color="neutral" variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {nextSkip < total && (
                  <Link href={`/dropship/suppliers/${id}/catalog?skip=${nextSkip}${qParam}`}>
                    <Button color="neutral" variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
