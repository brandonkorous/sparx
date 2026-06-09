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

import { FieldError } from './step-basics';

export interface PricingData {
  priceStr: string;
  compareAtStr: string;
  taxClass: string;
}

interface StepPricingProps {
  data: PricingData;
  onChange: (data: PricingData) => void;
  fieldErrors: Record<string, string>;
}

export function StepPricing({ data, onChange, fieldErrors }: StepPricingProps) {
  return (
    <Stack gap={5}>
      <Card>
        <CardHeader>
          <Heading level={3}>Pricing</Heading>
          <CardDescription>
            Set the selling price and an optional compare-at (strikethrough) price for sales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={4}>
              <Stack gap={2} className="flex-1">
                <Label htmlFor="wiz-price">
                  Price{' '}
                  <span aria-hidden className="text-[var(--color-text-danger)]">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">
                    $
                  </span>
                  <Input
                    id="wiz-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7"
                    value={data.priceStr}
                    onChange={(e) => onChange({ ...data, priceStr: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.price)}
                  />
                </div>
                {fieldErrors.price && <FieldError msg={fieldErrors.price} />}
              </Stack>

              <Stack gap={2} className="flex-1">
                <Label htmlFor="wiz-compare-at">Compare-at price</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">
                    $
                  </span>
                  <Input
                    id="wiz-compare-at"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7"
                    value={data.compareAtStr}
                    onChange={(e) => onChange({ ...data, compareAtStr: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.compareAt)}
                  />
                </div>
                {fieldErrors.compareAt ? (
                  <FieldError msg={fieldErrors.compareAt} />
                ) : (
                  <Text size="xs" variant="muted">
                    Shown as strikethrough to signal a sale. Leave blank to hide.
                  </Text>
                )}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={3}>Tax</Heading>
          <CardDescription>
            The tax class controls which tax rates apply at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={2}>
            <Label htmlFor="wiz-tax-class">Tax class</Label>
            <Input
              id="wiz-tax-class"
              placeholder="standard, food, digital, apparel…"
              value={data.taxClass}
              onChange={(e) => onChange({ ...data, taxClass: e.target.value })}
            />
            <Text size="xs" variant="muted">
              Leave blank to use the default tax class. Use the same values across similar products
              for consistent tax treatment.
            </Text>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
