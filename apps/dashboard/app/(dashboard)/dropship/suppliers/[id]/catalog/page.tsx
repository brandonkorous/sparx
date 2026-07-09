export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
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
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <Link
          href="/dropship/suppliers"
          className="text-base-content/70 hover:text-base-content flex w-fit items-center gap-1 text-sm"
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
          <Card>
            <CardBody className="p-0">
              <EmptyState
                title={q ? `No products match "${q}"` : 'No catalog entries yet'}
                description={
                  q
                    ? 'Try a different search term or clear the filter.'
                    : 'Trigger a catalog sync to pull products from this supplier.'
                }
              />
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="border-base-300 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                {/* eslint-disable-next-line no-restricted-syntax -- table header with muted bg, not a reimplemented control */}
                <thead className="bg-base-200 text-base-content/70">
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
                <tbody className="divide-base-300 divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-base-200">
                      <td className="px-4 py-3">
                        <div className="flex flex-row items-center gap-3">
                          {p.images[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.title}
                              className="bg-base-200 h-10 w-10 flex-shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="bg-base-200 h-10 w-10 flex-shrink-0 rounded" />
                          )}
                          <p className="line-clamp-1 text-base font-medium">{p.title}</p>
                        </div>
                      </td>
                      <td className="text-base-content/70 px-4 py-3 font-mono text-xs">
                        {p.supplierProductId}
                      </td>
                      <td className="text-base-content/70 px-4 py-3">{p.variants.length}</td>
                      <td className="px-4 py-3">
                        {p.costPriceCents > 0 ? formatCents(p.costPriceCents) : '—'}
                      </td>
                      <td className="text-base-content/70 px-4 py-3">
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
              <div className="flex flex-row items-center justify-end gap-2">
                <p className="text-base-content/70 text-sm">
                  {skip + 1}–{Math.min(skip + take, total)} of {total}
                </p>
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
