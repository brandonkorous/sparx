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
  Switch,
  Text,
} from '@sparx/ui';

import { FieldError } from './step-basics';

export interface InventoryData {
  trackInventory: boolean;
  quantityStr: string;
  lowStockStr: string;
  weightKgStr: string;
  lengthCmStr: string;
  widthCmStr: string;
  heightCmStr: string;
}

interface StepInventoryProps {
  data: InventoryData;
  onChange: (data: InventoryData) => void;
  fieldErrors: Record<string, string>;
}

export function StepInventory({ data, onChange, fieldErrors }: StepInventoryProps) {
  return (
    <Stack gap={5}>
      <Card>
        <CardHeader>
          <Heading level={3}>Stock tracking</Heading>
          <CardDescription>
            Enable to track units on hand and block orders when you run out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" align="center" justify="between">
              <Stack gap={1}>
                <Text size="sm" className="font-medium">
                  Track inventory
                </Text>
                <Text size="xs" variant="muted">
                  When enabled, customers cannot add more than the available quantity to their cart.
                </Text>
              </Stack>
              <Switch
                checked={data.trackInventory}
                onCheckedChange={(checked) => onChange({ ...data, trackInventory: checked })}
                aria-label="Track inventory"
              />
            </Stack>

            {data.trackInventory && (
              <Stack direction="row" gap={4}>
                <Stack gap={2} className="flex-1">
                  <Label htmlFor="wiz-qty">Initial quantity</Label>
                  <Input
                    id="wiz-qty"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={data.quantityStr}
                    onChange={(e) => onChange({ ...data, quantityStr: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.quantity)}
                  />
                  {fieldErrors.quantity ? (
                    <FieldError msg={fieldErrors.quantity} />
                  ) : (
                    <Text size="xs" variant="muted">
                      Units on hand right now. Skip if you haven&apos;t received stock yet.
                    </Text>
                  )}
                </Stack>

                <Stack gap={2} className="flex-1">
                  <Label htmlFor="wiz-low-stock">Low stock threshold</Label>
                  <Input
                    id="wiz-low-stock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="5"
                    value={data.lowStockStr}
                    onChange={(e) => onChange({ ...data, lowStockStr: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.lowStock)}
                  />
                  {fieldErrors.lowStock ? (
                    <FieldError msg={fieldErrors.lowStock} />
                  ) : (
                    <Text size="xs" variant="muted">
                      Dashboard shows a warning badge below this level.
                    </Text>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={3}>Shipping dimensions</Heading>
          <CardDescription>
            Used to calculate shipping rates. Leave blank if you don&apos;t ship this product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="wiz-weight">Weight (kg)</Label>
              <Input
                id="wiz-weight"
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={data.weightKgStr}
                onChange={(e) => onChange({ ...data, weightKgStr: e.target.value })}
                aria-invalid={Boolean(fieldErrors.weight)}
              />
              {fieldErrors.weight && <FieldError msg={fieldErrors.weight} />}
            </Stack>

            <Stack direction="row" gap={3}>
              <Stack gap={2} className="flex-1">
                <Label htmlFor="wiz-length">Length (cm)</Label>
                <Input
                  id="wiz-length"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={data.lengthCmStr}
                  onChange={(e) => onChange({ ...data, lengthCmStr: e.target.value })}
                  aria-invalid={Boolean(fieldErrors.dimensions)}
                />
              </Stack>
              <Stack gap={2} className="flex-1">
                <Label htmlFor="wiz-width">Width (cm)</Label>
                <Input
                  id="wiz-width"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={data.widthCmStr}
                  onChange={(e) => onChange({ ...data, widthCmStr: e.target.value })}
                />
              </Stack>
              <Stack gap={2} className="flex-1">
                <Label htmlFor="wiz-height">Height (cm)</Label>
                <Input
                  id="wiz-height"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={data.heightCmStr}
                  onChange={(e) => onChange({ ...data, heightCmStr: e.target.value })}
                />
              </Stack>
            </Stack>
            {fieldErrors.dimensions && <FieldError msg={fieldErrors.dimensions} />}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
