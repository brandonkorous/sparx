// Dropship products — all commerce products that were imported from a supplier.
// Fetches from /v1/dropship/suppliers (all) → /v1/dropship/suppliers/:id/catalog (imported only).
// NOTE: this page will be replaced by a proper /v1/dropship/products endpoint in Ph3.

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { PageHeader } from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState } from 'silicaui-react';
import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import {
  DropshipProductsList,
  type DropshipProduct,
  type SupplierGroup,
} from './_components/dropship-products-list';

interface Supplier {
  id: string;
  name: string;
  type: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DropshipProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ data: suppliers }, prefs] = await Promise.all([
    api.getPaged<Supplier[]>('/v1/dropship/suppliers?take=100'),
    getUserPreferences(),
  ]);

  const productsBySupplier: SupplierGroup[] = [];

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

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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

        <ListToolbar searchPlaceholder="Search products…" enableViewToggle />

        {totalImported === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                title="No products imported yet"
                description="Browse a supplier's catalog and import products to see them here."
                actions={
                  <Link href="/dropship/suppliers">
                    <Button color="module" variant="soft">
                      Browse suppliers
                    </Button>
                  </Link>
                }
              />
            </CardBody>
          </Card>
        ) : (
          <DropshipProductsList groups={productsBySupplier} view={view} />
        )}
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
