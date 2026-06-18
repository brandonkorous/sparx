'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Heading,
  Label,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';

import { mapUnmappedSkuAction, ignoreUnmappedSkuAction } from '../../../_lib/sync-actions';
import { VariantPicker, type PickedVariant } from './variant-picker';
import {
  MappingControlsFields,
  controlsToBody,
  EMPTY_CONTROLS,
  type ControlsState,
} from './mapping-controls';
import { externalRef, formatDateTime, type UnmappedSkuRow, type WarehouseOption } from './types';

// The unmapped-SKU review queue (docs/28 §6/§7) — external SKUs a feed reported
// that resolve to no mapping. Each row can be mapped to a (variant, warehouse)
// (which mints a link so the next sync matches it) or ignored. A SKU that exactly
// matches one of our variants is pre-suggested for one-click mapping.

interface UnmappedQueueProps {
  sourceId: string;
  rows: UnmappedSkuRow[];
  warehouses: WarehouseOption[];
}

export function UnmappedQueue({ sourceId, rows, warehouses }: UnmappedQueueProps) {
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Stack gap={1}>
            <Heading level={3}>Unmapped SKUs</Heading>
            <CardDescription>
              SKUs the feed reported that aren’t mapped to an item yet. Map each to a variant +
              warehouse, or ignore it.
            </CardDescription>
          </Stack>
          {rows.length > 0 ? (
            <Badge color="warning" variant="soft">
              {rows.length} pending
            </Badge>
          ) : null}
        </Stack>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing to map"
            description="Every SKU this source reported is mapped to an item."
          />
        ) : (
          <Stack gap={2}>
            {rows.map((row) => (
              <UnmappedRow key={row.id} sourceId={sourceId} row={row} warehouses={warehouses} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function UnmappedRow({
  sourceId,
  row,
  warehouses,
}: {
  sourceId: string;
  row: UnmappedSkuRow;
  warehouses: WarehouseOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [mapping, setMapping] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warehouseId, setWarehouseId] = React.useState(warehouses[0]?.id ?? '');
  const [controls, setControls] = React.useState<ControlsState>(EMPTY_CONTROLS);
  const [variant, setVariant] = React.useState<PickedVariant | null>(
    row.suggestedVariantId
      ? {
          variantId: row.suggestedVariantId,
          sku: row.suggestedVariantSku ?? row.externalSku,
          title: row.suggestedProductTitle,
        }
      : null
  );

  function confirmMap() {
    if (!variant) {
      setError('Resolve a variant to map to.');
      return;
    }
    if (!warehouseId) {
      setError('Choose a warehouse.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await mapUnmappedSkuAction(sourceId, row.id, {
        variantId: variant.variantId,
        warehouseId,
        ...controlsToBody(controls),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function ignore() {
    setError(null);
    startTransition(async () => {
      const result = await ignoreUnmappedSkuAction(sourceId, row.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Stack gap={3} className="rounded border border-[var(--color-border-default)] px-3 py-3">
      <Stack direction="row" align="center" justify="between" wrap gap={3}>
        <Stack gap={0} className="min-w-0">
          <Text size="sm" className="font-mono font-medium">
            {externalRef(row.externalSku, row.externalLocation)}
          </Text>
          <Text size="xs" variant="muted">
            qty {row.lastQuantity} · seen {row.seenCount}× · last {formatDateTime(row.lastSeenAt)}
          </Text>
        </Stack>
        <Stack direction="row" gap={2} align="center">
          {row.suggestedVariantId && !mapping ? (
            <Badge color="info" variant="soft">
              suggested: {row.suggestedVariantSku}
            </Badge>
          ) : null}
          {!mapping ? (
            <>
              <Button color="module" size="sm" onClick={() => setMapping(true)}>
                Map
              </Button>
              <Button variant="ghost" size="sm" onClick={ignore} disabled={pending}>
                Ignore
              </Button>
            </>
          ) : null}
        </Stack>
      </Stack>

      {mapping ? (
        <Stack gap={3} className="border-t border-[var(--color-border-default)] pt-3">
          <Stack direction="row" gap={4} wrap align="end">
            <Stack gap={1} className="min-w-[16rem] flex-1">
              <Label>Map to item</Label>
              <VariantPicker
                variant={variant}
                onResolve={setVariant}
                onClear={() => setVariant(null)}
                defaultSku={row.externalSku}
              />
            </Stack>
            <Stack gap={1} className="min-w-[12rem]">
              <Label htmlFor={`wh-${row.id}`}>Warehouse</Label>
              <NativeSelect
                id={`wh-${row.id}`}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </NativeSelect>
            </Stack>
          </Stack>
          <MappingControlsFields idPrefix={`u-${row.id}`} state={controls} onChange={setControls} />
          <Stack direction="row" gap={2} justify="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMapping(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button color="module" size="sm" onClick={confirmMap} disabled={pending}>
              {pending ? 'Mapping…' : 'Map SKU'}
            </Button>
          </Stack>
        </Stack>
      ) : null}

      {error ? (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
