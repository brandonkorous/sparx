import { DollarSign, Plus } from 'lucide-react';

import { Badge, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
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

export default async function PricingPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, priceLists, bulkTiers] = await Promise.all([
    getUserPreferences(),
    api.get<PriceListRow[]>('/v1/commerce/price-lists'),
    api.get<BulkPriceTierRow[]>('/v1/commerce/bulk-tiers'),
  ]);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<DollarSign className="h-5 w-5" />}
          title="Pricing"
          badge={<Badge color="module">{priceLists.length} price lists</Badge>}
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

        <ListToolbar enableViewToggle searchable={false} />

        <PricingLists priceLists={priceLists} bulkTiers={bulkTiers} view={view} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
