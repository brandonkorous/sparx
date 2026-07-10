export const dynamic = 'force-dynamic';

import { Truck } from 'lucide-react';
import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { api } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { NewSupplierButton } from './_components/new-supplier-button';
import { SuppliersList } from './_components/suppliers-list';
import type { Vendor, SiteOption, VendorCredentialField } from './_components/supplier-form';

interface Supplier {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  pricingRule: { type: string; value: number } | null;
  notes: string | null;
  createdAt: string;
  // The credential field spec + "is a token on file?" flag now come from the
  // API (toSupplierView), so the edit form is self-sufficient.
  credentialFields?: VendorCredentialField[];
  credentialsSet?: boolean;
  siteScope?: string[];
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DropshipSuppliersPage({ searchParams }: Props) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = typeof params.q === 'string' ? params.q : undefined;
  const qs = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (q) qs.set('q', q);

  // Suppliers, the connectable vendor catalog, and the tenant's sites — all
  // fail-soft so the page still renders the connect affordance.
  const [{ data: suppliers, meta }, vendors, properties, prefs] = await Promise.all([
    api.getPaged<Supplier[]>(`/v1/dropship/suppliers?${qs}`),
    api.get<Vendor[]>('/v1/dropship/vendors').catch(() => [] as Vendor[]),
    listProperties().catch(() => [] as Property[]),
    getUserPreferences(),
  ]);
  const total = (meta?.total as number | undefined) ?? suppliers.length;

  const sites: SiteOption[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    isPrimary: p.isPrimary,
  }));

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Suppliers"
          badge={
            <Badge color="module" variant="soft">
              {total} supplier{total !== 1 ? 's' : ''}
            </Badge>
          }
          description="Connect suppliers to source and import products for dropshipping."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search suppliers…"
          enableViewToggle
          primaryAction={<NewSupplierButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {suppliers.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              title={q ? `No suppliers match "${q}"` : 'No suppliers connected'}
              description={
                q
                  ? 'Try a different search term.'
                  : 'Connect your first supplier to start importing dropship products.'
              }
              actions={!q ? <NewSupplierButton /> : undefined}
            />
          </CardBody>
        </Card>
      ) : (
        <SuppliersList
          suppliers={suppliers}
          view={view}
          sites={sites}
          vendors={vendors}
          showSites={sites.length > 1}
        />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
