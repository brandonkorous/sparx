'use client';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

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
        <Stack gap={1}>
          <Text size="sm" className="font-medium">
            {t.name}
          </Text>
          {t.description ? (
            <Text size="xs" variant="muted">
              {t.description}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      header: 'Discount',
      cell: (t) => (
        <Badge color="module" variant="soft">
          {discountLabel(t)}
        </Badge>
      ),
    },
    {
      header: 'Scope',
      cell: (t) => (
        <Text size="sm" variant="muted">
          {scopeLabel(t.productScope)}
        </Text>
      ),
    },
    {
      header: 'Minimum order',
      align: 'right',
      cell: (t) => (
        <Text size="sm" variant="muted">
          {t.minOrderCents > 0 ? minOrderLabel(t.minOrderCents) : '—'}
        </Text>
      ),
    },
    {
      header: 'Accounts',
      align: 'right',
      cell: (t) => (
        <Text size="sm" variant="muted">
          {t.accountCount ?? '—'}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<PricingTierRow> = {
    title: (t) => <CardTitle>{t.name}</CardTitle>,
    render: (tier) => (
      <Card>
        <CardHeader>
          <Stack direction="row" align="start" justify="between" gap={2}>
            <CardTitle>{tier.name}</CardTitle>
            <Badge color="module" variant="soft">
              {discountLabel(tier)}
            </Badge>
          </Stack>
          {tier.description && <CardDescription>{tier.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Stack gap={2}>
            <Stack direction="row" justify="between">
              <Text size="sm" variant="muted">
                Scope
              </Text>
              <Text size="sm">{scopeLabel(tier.productScope)}</Text>
            </Stack>
            {tier.minOrderCents > 0 && (
              <Stack direction="row" justify="between">
                <Text size="sm" variant="muted">
                  Minimum order
                </Text>
                <Text size="sm">{minOrderLabel(tier.minOrderCents)}</Text>
              </Stack>
            )}
            {tier.accountCount !== undefined && (
              <Stack direction="row" justify="between">
                <Text size="sm" variant="muted">
                  Accounts
                </Text>
                <Text size="sm">{tier.accountCount}</Text>
              </Stack>
            )}
          </Stack>
        </CardContent>
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
