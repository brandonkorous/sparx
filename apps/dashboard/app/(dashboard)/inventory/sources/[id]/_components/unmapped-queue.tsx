'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Label,
  NativeSelect,
} from '@wizeworks/silicaui-react';

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
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Unmapped SKUs</h3>
            <p className="opacity-70">
              SKUs the feed reported that aren’t mapped to an item yet. Map each to a variant +
              warehouse, or ignore it.
            </p>
          </div>
          {rows.length > 0 ? (
            <Badge color="warning" variant="soft">
              {rows.length} pending
            </Badge>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing to map"
            description="Every SKU this source reported is mapped to an item."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <UnmappedRow key={row.id} sourceId={sourceId} row={row} warehouses={warehouses} />
            ))}
          </div>
        )}
      </CardBody>
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
    <div className="border-base-300 flex flex-col gap-3 rounded border px-3 py-3">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0">
          <p className="font-mono text-sm font-medium">
            {externalRef(row.externalSku, row.externalLocation)}
          </p>
          <p className="text-base-content text-xs">
            qty {row.lastQuantity} · seen {row.seenCount}× · last {formatDateTime(row.lastSeenAt)}
          </p>
        </div>
        <div className="flex flex-row items-center gap-2">
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
        </div>
      </div>

      {mapping ? (
        <div className="border-base-300 flex flex-col gap-3 border-t pt-3">
          <div className="flex flex-row flex-wrap items-end gap-4">
            <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
              <Label>Map to item</Label>
              <VariantPicker
                variant={variant}
                onResolve={setVariant}
                onClear={() => setVariant(null)}
                defaultSku={row.externalSku}
              />
            </div>
            <div className="flex min-w-[12rem] flex-col gap-1">
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
            </div>
          </div>
          <MappingControlsFields idPrefix={`u-${row.id}`} state={controls} onChange={setControls} />
          <div className="flex flex-row justify-end gap-2">
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
          </div>
        </div>
      ) : null}

      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
