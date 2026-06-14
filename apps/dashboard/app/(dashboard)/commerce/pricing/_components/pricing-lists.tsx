'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Heading,
  Stack,
  Text,
} from '@sparx/ui';
import { DollarSign, Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';
import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the Pricing overview. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands the two sections' rows + a shared `view` here and this builds both
// lists. Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open
// the price-list detail via EntityRowLink. The single `view` from the page-level
// ListToolbar flips BOTH sections together.

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline'> = {
  active: 'success',
  draft: 'outline',
  archived: 'warning',
};

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

interface PricingListsProps {
  priceLists: PriceListRow[];
  bulkTiers: BulkPriceTierRow[];
  view: 'table' | 'card';
}

export function PricingLists({ priceLists, bulkTiers, view }: PricingListsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Price lists</Heading>
            <CardDescription>
              Channel/segment/B2B-targeted price overrides. Higher priority wins when multiple lists
              are eligible.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          {priceLists.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title="No price lists yet"
              description="Create one to offer per-channel pricing (e.g. B2B portal at 15% off) or per-segment pricing (e.g. wholesale customers)."
              action={
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
          ) : (
            <SelectionList
              items={priceLists}
              view={view}
              getId={(l) => l.id}
              selectable={false}
              entityLabelPlural="price lists"
              getRowLabel={(l) => l.name}
              columns={priceListColumns}
              card={priceListCard}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Bulk price tiers</Heading>
            <CardDescription>
              Quantity ramps without a discount code. Variant-scoped tiers override list-scoped
              tiers when both apply.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          {bulkTiers.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title="No bulk tiers yet"
              description="Add a quantity ramp from a product detail page (Pricing tab) or a price list (Bulk tiers tab)."
            />
          ) : (
            <SelectionList
              items={bulkTiers}
              view={view}
              getId={(t) => t.id}
              selectable={false}
              entityLabelPlural="bulk tiers"
              getRowLabel={(t) => (t.variantId ? 'variant' : 'price list')}
              columns={bulkTierColumns}
              card={bulkTierCard}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

const priceListName = (list: PriceListRow) => (
  <EntityRowLink
    href={`/commerce/pricing/${list.id}`}
    entityType="price-list"
    entityId={list.id}
    className="hover:text-[var(--module-active)]"
  >
    {list.name}
  </EntityRowLink>
);

const priceListChannel = (list: PriceListRow) =>
  list.channel ? (
    <Badge variant="outline">{list.channel}</Badge>
  ) : (
    <Text size="xs" variant="muted">
      all
    </Text>
  );

const priceListStatus = (list: PriceListRow) => (
  <Badge color={STATUS_VARIANT[list.status] ?? 'outline'}>{list.status}</Badge>
);

const priceListColumns: SelectionColumn<PriceListRow>[] = [
  { header: 'Name', cell: priceListName },
  {
    header: 'Currency',
    cell: (list) => <span className="font-mono text-xs">{list.currency}</span>,
  },
  { header: 'Channel', cell: priceListChannel },
  { header: 'Priority', cell: (list) => list.priority },
  { header: 'Entries', cell: (list) => list.entryCount },
  { header: 'Status', cell: priceListStatus },
];

const priceListCard: SelectionCard<PriceListRow> = {
  title: priceListName,
  badge: priceListStatus,
  body: (list) => (
    <Stack gap={2}>
      <Stack direction="row" align="center" gap={2} wrap>
        <span className="font-mono text-xs">{list.currency}</span>
        {priceListChannel(list)}
      </Stack>
      <Stack direction="row" gap={4} wrap>
        <Text size="xs" variant="muted">
          Priority: {list.priority}
        </Text>
        <Text size="xs" variant="muted">
          Entries: {list.entryCount}
        </Text>
      </Stack>
    </Stack>
  ),
};

const bulkTierScope = (tier: BulkPriceTierRow) =>
  tier.variantId ? (
    <Badge variant="outline">variant</Badge>
  ) : (
    <Badge variant="outline">price list</Badge>
  );

const bulkTierColumns: SelectionColumn<BulkPriceTierRow>[] = [
  { header: 'Scope', cell: bulkTierScope },
  { header: 'Min qty', cell: (tier) => `${tier.minQuantity}+` },
  { header: 'Unit price', cell: (tier) => moneyFmt.format(tier.unitPriceCents / 100) },
];

const bulkTierCard: SelectionCard<BulkPriceTierRow> = {
  title: (tier) => moneyFmt.format(tier.unitPriceCents / 100),
  badge: bulkTierScope,
  body: (tier) => (
    <Text size="xs" variant="muted">
      Min qty: {tier.minQuantity}+
    </Text>
  ),
};
