import { DollarSign, Plus } from 'lucide-react';

import { Badge } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { PricingLists } from './_components/pricing-lists';

// Pricing — price lists, contract prices, bulk tiers.
// Resolution order is locked: contract → price list → bulk tier → base
// (see packages/commerce/src/services/pricing-service.ts). This page
// shows all three layers + lets staff manage price lists; per-list entry
// editing lives on the detail page. A standard Collection/List surface
// (docs/34 §7): one ListToolbar view toggle flips both sections together.

export const dynamic = 'force-dynamic';

interface PriceListRow {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  channel: string | null;
  customerSegmentId: string | null;
  b2bAccountId: string | null;
  collectionId: string | null;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  status: string;
  entryCount: number;
  updatedAt: string;
}

interface BulkPriceTierRow {
  id: string;
  variantId: string | null;
  priceListId: string | null;
  minQuantity: number;
  unitPriceCents: number;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const CHANNEL_OPTIONS = [
  { value: 'storefront', label: 'Storefront' },
  { value: 'b2b_portal', label: 'B2B portal' },
  { value: 'admin', label: 'Admin' },
  { value: 'subscription', label: 'Subscription' },
];

export default async function PricingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // Only the PRIMARY section (price lists) is paged + filtered; bulk tiers stay a
  // small, un-paged fetch (no text to search), so the shared toolbar drives the
  // price-list query.
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const status = stringParam(params.status);
  const channel = stringParam(params.channel);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  if (channel) query.set('channel', channel);

  const [prefs, priceListsPage, bulkTiers] = await Promise.all([
    getUserPreferences(),
    api.getPaged<PriceListRow[]>(`/v1/commerce/price-lists?${query.toString()}`),
    api.get<BulkPriceTierRow[]>('/v1/commerce/bulk-tiers'),
  ]);

  const priceLists = priceListsPage.data;
  const priceListTotal = (priceListsPage.meta?.total as number | undefined) ?? priceLists.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<DollarSign className="h-5 w-5" />}
          title="Pricing"
          badge={<Badge color="module">{priceListTotal} price lists</Badge>}
          description="Resolution order: B2B contract price → price list → bulk tier → variant base. Discounts apply on top via the Discounts page."
          actions={
            <EntityCreateButton
              entityType="price-list"
              newHref="/commerce/pricing/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          enableViewToggle
          searchPlaceholder="Search price lists…"
          filters={[
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            { key: 'channel', label: 'Channel', options: CHANNEL_OPTIONS },
          ]}
        />

        <PricingLists
          priceLists={priceLists}
          bulkTiers={bulkTiers}
          view={view}
          priceListTotal={priceListTotal}
        />
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
