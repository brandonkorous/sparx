'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle } from 'silicaui-react';

// Client wrapper for the pricing-tiers list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Pricing
// tiers are reference data — read-only, `selectable={false}` (no checkboxes /
// bulk bar); the existing card layout is preserved verbatim via `card.render`.

export interface PricingTierRow {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  productScope: string;
  minOrderCents: number;
  accountCount?: number;
  createdAt: string;
}

interface PricingTiersListProps {
  rows: PricingTierRow[];
  view: 'table' | 'card';
}

function discountLabel(t: PricingTierRow) {
  if (t.discountType === 'percentage') return `${t.discountValue}% off list`;
  return `$${(t.discountValue / 100).toFixed(2)} off`;
}

function scopeLabel(scope: string) {
  if (scope === 'all') return 'All products';
  if (scope === 'collections') return 'Selected collections';
  return 'Selected products';
}

function minOrderLabel(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

export function PricingTiersList({ rows, view }: PricingTiersListProps) {
  const columns: SelectionColumn<PricingTierRow>[] = [
    {
      header: 'Name',
      cell: (t) => (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t.name}</p>
          {t.description ? <p className="text-base-content/70 text-xs">{t.description}</p> : null}
        </div>
      ),
    },
    {
      header: 'Discount',
      cell: (t) => (
        <Badge color="module" variant="soft" size="sm">
          {discountLabel(t)}
        </Badge>
      ),
    },
    {
      header: 'Scope',
      cell: (t) => <p className="text-base-content/70 text-sm">{scopeLabel(t.productScope)}</p>,
    },
    {
      header: 'Minimum order',
      align: 'right',
      cell: (t) => (
        <p className="text-base-content/70 text-sm">
          {t.minOrderCents > 0 ? minOrderLabel(t.minOrderCents) : '—'}
        </p>
      ),
    },
    {
      header: 'Accounts',
      align: 'right',
      cell: (t) => <p className="text-base-content/70 text-sm">{t.accountCount ?? '—'}</p>,
    },
  ];

  const card: SelectionCard<PricingTierRow> = {
    title: (t) => <CardTitle>{t.name}</CardTitle>,
    render: (tier) => (
      <Card>
        <CardBody>
          <div className="flex flex-row items-start justify-between gap-2">
            <CardTitle>{tier.name}</CardTitle>
            <Badge color="module" variant="soft" size="sm">
              {discountLabel(tier)}
            </Badge>
          </div>
          {tier.description && <p className="opacity-70">{tier.description}</p>}
          <div className="flex flex-col gap-2">
            <div className="flex flex-row justify-between">
              <p className="text-base-content/70 text-sm">Scope</p>
              <p className="text-sm">{scopeLabel(tier.productScope)}</p>
            </div>
            {tier.minOrderCents > 0 && (
              <div className="flex flex-row justify-between">
                <p className="text-base-content/70 text-sm">Minimum order</p>
                <p className="text-sm">{minOrderLabel(tier.minOrderCents)}</p>
              </div>
            )}
            {tier.accountCount !== undefined && (
              <div className="flex flex-row justify-between">
                <p className="text-base-content/70 text-sm">Accounts</p>
                <p className="text-sm">{tier.accountCount}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(t) => t.id}
      selectable={false}
      entityLabelPlural="pricing tiers"
      getRowLabel={(t) => t.name}
      columns={columns}
      card={card}
    />
  );
}
