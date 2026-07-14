'use client';

import type { ReactNode } from 'react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { DollarSign, Plus } from 'lucide-react';

import { EntityCreateButton } from '../../../_components/entity-create-button';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { ListPager } from '../../../_components/list-pager';

// Client wrapper for the Pricing overview. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands the two sections' rows + a shared `view` here and this builds both
// lists. Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open
// the price-list detail via EntityRowLink. The single `view` from the page-level
// ListToolbar flips BOTH sections together.

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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
  /** Total price-list count (the only paged section); bulk tiers stay un-paged. */
  priceListTotal: number;
  /** id → company name, for rendering a b2bAccountId target as a readable name. */
  b2bAccountLabels: Record<string, string>;
  /** id → segment name, for rendering a customerSegmentId target as a readable name. */
  segmentLabels: Record<string, string>;
}

export function PricingLists({
  priceLists,
  bulkTiers,
  view,
  priceListTotal,
  b2bAccountLabels,
  segmentLabels,
}: PricingListsProps) {
  const priceListColumns = makePriceListColumns(b2bAccountLabels, segmentLabels);
  const priceListCard = makePriceListCard(b2bAccountLabels, segmentLabels);

  return (
    <div className="flex flex-col gap-8">
      <PricingSection
        title="Price lists"
        description="Channel/segment/B2B-targeted price overrides. Higher priority wins when multiple lists are eligible."
      >
        {priceLists.length === 0 ? (
          <Card className="bg-module bg-soft">
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title="No price lists yet"
              description="Create one to offer per-channel pricing (e.g. B2B portal at 15% off) or per-segment pricing (e.g. wholesale customers)."
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
          </Card>
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
        <ListPager total={priceListTotal} />
      </PricingSection>

      <PricingSection
        title="Bulk price tiers"
        description="Quantity ramps without a discount code. Variant-scoped tiers override list-scoped tiers when both apply."
      >
        {bulkTiers.length === 0 ? (
          <Card className="bg-module bg-soft">
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title="No bulk tiers yet"
              description="Add a quantity ramp from a product detail page (Pricing tab) or a price list (Bulk tiers tab)."
            />
          </Card>
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
      </PricingSection>
    </div>
  );
}

// Pricing carries TWO tables on one page, so each is introduced by a typographic
// section header (heading + muted lede) and then the BARE SelectionList — never an
// outer Card. SelectionList already renders the table inside its own
// `Card padding="none"`, so wrapping it in another Card would nest cards (banned)
// and box the table differently from every other list surface (products,
// discounts, …). This is the compliant way to title multiple list sections.
function PricingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-base-content/70 text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

const priceListName = (list: PriceListRow) => (
  <EntityRowLink
    href={`/commerce/pricing/${list.id}`}
    entityType="price-list"
    entityId={list.id}
    className="hover:text-module"
  >
    {list.name}
  </EntityRowLink>
);

const priceListChannel = (list: PriceListRow) =>
  list.channel ? (
    <Badge color="neutral" variant="soft" size="sm">
      {statusLabel(list.channel)}
    </Badge>
  ) : (
    <p className="text-base-content/70 text-xs">all</p>
  );

// Status pill: color resolved from the canonical statusTone() map (docs/35 §9) so
// draft/active/archived read the same tone here as on every other surface
// (draft→warning, active→success, archived→neutral) — never an ad-hoc per-list map.
const priceListStatus = (list: PriceListRow) => (
  <Badge color={statusTone(list.status)} variant="soft" size="sm">
    {statusLabel(list.status)}
  </Badge>
);

// Target: the readable name of the b2bAccountId/customerSegmentId this list is
// narrowed to, resolved from the bounded label maps the page fetched (no join
// on the price-list row itself — see _lib/targeting-options.ts).
function priceListTarget(
  list: PriceListRow,
  b2bAccountLabels: Record<string, string>,
  segmentLabels: Record<string, string>
) {
  const label = list.b2bAccountId
    ? (b2bAccountLabels[list.b2bAccountId] ?? 'B2B account')
    : list.customerSegmentId
      ? (segmentLabels[list.customerSegmentId] ?? 'Segment')
      : null;
  return label ? (
    <Badge color="module" variant="soft" size="sm">
      {label}
    </Badge>
  ) : (
    <p className="text-base-content/70 text-xs">everyone</p>
  );
}

function makePriceListColumns(
  b2bAccountLabels: Record<string, string>,
  segmentLabels: Record<string, string>
): SelectionColumn<PriceListRow>[] {
  return [
    { header: 'Name', cell: priceListName },
    {
      header: 'Currency',
      cell: (list) => <span className="font-mono text-xs">{list.currency}</span>,
    },
    { header: 'Channel', cell: priceListChannel },
    { header: 'Target', cell: (list) => priceListTarget(list, b2bAccountLabels, segmentLabels) },
    { header: 'Priority', cell: (list) => list.priority },
    { header: 'Entries', cell: (list) => list.entryCount },
    { header: 'Status', cell: priceListStatus },
  ];
}

function makePriceListCard(
  b2bAccountLabels: Record<string, string>,
  segmentLabels: Record<string, string>
): SelectionCard<PriceListRow> {
  return {
    title: priceListName,
    badge: priceListStatus,
    body: (list) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{list.currency}</span>
          {priceListChannel(list)}
          {priceListTarget(list, b2bAccountLabels, segmentLabels)}
        </div>
        <div className="flex flex-row flex-wrap gap-4">
          <p className="text-base-content/70 text-xs">Priority: {list.priority}</p>
          <p className="text-base-content/70 text-xs">Entries: {list.entryCount}</p>
        </div>
      </div>
    ),
  };
}

const bulkTierScope = (tier: BulkPriceTierRow) =>
  tier.variantId ? (
    <Badge color="info" variant="soft" size="sm">
      variant
    </Badge>
  ) : (
    <Badge color="neutral" variant="soft" size="sm">
      price list
    </Badge>
  );

const bulkTierColumns: SelectionColumn<BulkPriceTierRow>[] = [
  { header: 'Scope', cell: bulkTierScope },
  { header: 'Min qty', cell: (tier) => `${tier.minQuantity}+` },
  { header: 'Unit price', cell: (tier) => moneyFmt.format(tier.unitPriceCents / 100) },
];

const bulkTierCard: SelectionCard<BulkPriceTierRow> = {
  title: (tier) => moneyFmt.format(tier.unitPriceCents / 100),
  badge: bulkTierScope,
  body: (tier) => <p className="text-base-content/70 text-xs">Min qty: {tier.minQuantity}+</p>,
};
