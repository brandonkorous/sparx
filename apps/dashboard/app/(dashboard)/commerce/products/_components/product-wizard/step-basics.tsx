'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';

export type FulfillmentType = 'physical' | 'digital' | 'service';

export interface BasicsData {
  title: string;
  sku: string;
  fulfillmentType: FulfillmentType;
}

interface StepBasicsProps {
  data: BasicsData;
  onChange: (data: BasicsData) => void;
  fieldErrors: Record<string, string>;
}

const PRODUCT_TYPES: { value: FulfillmentType; label: string; description: string }[] = [
  {
    value: 'physical',
    label: 'Physical',
    description: 'Shipped goods — tracked inventory, weight & dimensions.',
  },
  {
    value: 'digital',
    label: 'Digital',
    description: 'Downloads, licenses, or access keys — no shipping.',
  },
  {
    value: 'service',
    label: 'Service',
    description: 'Bookings, installs, or work orders — no shipping.',
  },
];

export function StepBasics({ data, onChange, fieldErrors }: StepBasicsProps) {
  return (
    <Stack gap={5}>
      <Card>
        <CardHeader>
          <Heading level={3}>Product details</Heading>
          <CardDescription>Name this product and give it a unique identifier.</CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="wiz-title">
                Name{' '}
                <span aria-hidden className="text-[var(--color-text-danger)]">
                  *
                </span>
              </Label>
              <Input
                id="wiz-title"
                placeholder="e.g. Heavy-Duty Floor Jack, 3-Ton"
                value={data.title}
                onChange={(e) => onChange({ ...data, title: e.target.value })}
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title && <FieldError msg={fieldErrors.title} />}
            </Stack>

            <Stack gap={2}>
              <Label htmlFor="wiz-sku">
                SKU{' '}
                <span aria-hidden className="text-[var(--color-text-danger)]">
                  *
                </span>
              </Label>
              <Input
                id="wiz-sku"
                placeholder="e.g. JACK-3T-HD or BF-2024-001"
                value={data.sku}
                onChange={(e) => onChange({ ...data, sku: e.target.value })}
                aria-invalid={Boolean(fieldErrors.sku)}
              />
              {fieldErrors.sku ? (
                <FieldError msg={fieldErrors.sku} />
              ) : (
                <Text size="xs" variant="muted">
                  Unique across all your products. Used for imports, barcodes, and order line items.
                </Text>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={3}>Product type</Heading>
          <CardDescription>
            Determines shipping, inventory tracking, and fulfillment routing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            {PRODUCT_TYPES.map((t) => {
              const selected = data.fulfillmentType === t.value;
              return (
                <label
                  key={t.value}
                  aria-label={t.label}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                    selected
                      ? 'border-[var(--module-active)] bg-[var(--module-active-tint)]'
                      : 'border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    className="mt-0.5 accent-[var(--module-active)]"
                    name="fulfillmentType"
                    value={t.value}
                    checked={selected}
                    onChange={() => onChange({ ...data, fulfillmentType: t.value })}
                  />
                  <Stack gap={1}>
                    <Text size="sm" className="font-medium">
                      {t.label}
                    </Text>
                    <Text size="xs" variant="muted">
                      {t.description}
                    </Text>
                  </Stack>
                </label>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return (
    <Text size="xs" variant="danger">
      {msg}
    </Text>
  );
}
