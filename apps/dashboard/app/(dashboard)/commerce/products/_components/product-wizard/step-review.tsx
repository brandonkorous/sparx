'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, Heading, Stack, Text } from '@sparx/ui';

import type { BasicsData } from './step-basics';
import type { InventoryData } from './step-inventory';
import type { PricingData } from './step-pricing';

interface StepReviewProps {
  basics: BasicsData;
  pricing: PricingData;
  inventory: InventoryData | null;
  pending: boolean;
  error: string | null;
  onEdit: (step: number) => void;
  onSubmit: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  physical: 'Physical goods',
  digital: 'Digital download',
  service: 'Service / booking',
};

export function StepReview({
  basics,
  pricing,
  inventory,
  pending,
  error,
  onEdit,
  onSubmit,
}: StepReviewProps) {
  const priceLabel = pricing.priceStr ? `$${parseFloat(pricing.priceStr).toFixed(2)}` : '—';
  const compareLabel = pricing.compareAtStr
    ? `$${parseFloat(pricing.compareAtStr).toFixed(2)}`
    : '—';

  return (
    <Stack gap={5}>
      <Card>
        <CardHeader>
          <Stack direction="row" align="center" justify="between">
            <Heading level={3}>Basics</Heading>
            <Button variant="ghost" size="sm" onClick={() => onEdit(0)}>
              Edit
            </Button>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={2}>
            <ReviewRow label="Name" value={basics.title} />
            <ReviewRow label="SKU" value={basics.sku} />
            <ReviewRow
              label="Type"
              value={TYPE_LABELS[basics.fulfillmentType] ?? basics.fulfillmentType}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Stack direction="row" align="center" justify="between">
            <Heading level={3}>Pricing</Heading>
            <Button variant="ghost" size="sm" onClick={() => onEdit(1)}>
              Edit
            </Button>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={2}>
            <ReviewRow label="Price" value={priceLabel} />
            {pricing.compareAtStr && <ReviewRow label="Compare-at" value={compareLabel} />}
            {pricing.taxClass && <ReviewRow label="Tax class" value={pricing.taxClass} />}
          </Stack>
        </CardContent>
      </Card>

      {inventory !== null && (
        <Card>
          <CardHeader>
            <Stack direction="row" align="center" justify="between">
              <Heading level={3}>Inventory</Heading>
              <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
                Edit
              </Button>
            </Stack>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              <ReviewRow
                label="Track inventory"
                value={inventory.trackInventory ? 'Yes — deny at zero' : 'No — allow oversell'}
              />
              {inventory.trackInventory && inventory.quantityStr && (
                <ReviewRow label="Initial qty" value={inventory.quantityStr} />
              )}
              {inventory.trackInventory && inventory.lowStockStr && (
                <ReviewRow label="Low stock alert" value={`≤ ${inventory.lowStockStr} units`} />
              )}
              {inventory.weightKgStr && (
                <ReviewRow label="Weight" value={`${inventory.weightKgStr} kg`} />
              )}
              {(inventory.lengthCmStr || inventory.widthCmStr || inventory.heightCmStr) && (
                <ReviewRow
                  label="Dimensions"
                  value={`${inventory.lengthCmStr || '?'} × ${inventory.widthCmStr || '?'} × ${inventory.heightCmStr || '?'} cm`}
                />
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite">
          {error}
        </Text>
      )}

      <Button
        color="module"
        onClick={onSubmit}
        disabled={pending}
        loading={pending}
        className="w-full sm:w-auto"
      >
        Create product
      </Button>
    </Stack>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" gap={2} className="min-w-0">
      <Text size="sm" variant="muted" className="w-32 shrink-0">
        {label}
      </Text>
      <Text size="sm" className="min-w-0 truncate font-medium">
        {value}
      </Text>
    </Stack>
  );
}
