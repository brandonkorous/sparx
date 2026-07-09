'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import { createSourceLinkAction, removeSourceLinkAction } from '../../../_lib/sync-actions';
import { VariantPicker, type PickedVariant } from './variant-picker';
import {
  MappingControlsFields,
  controlsToBody,
  EMPTY_CONTROLS,
  type ControlsState,
} from './mapping-controls';
import { externalRef, type SourceLinkRow, type WarehouseOption } from './types';

// SKU mapping view (docs/28 §7) — the links binding this source's external SKUs to
// (variant, warehouse) pairs. Add a mapping by hand (external SKU + optional
// location → item + warehouse) or remove one. Mapping an unmapped SKU from the
// queue lands here too.

interface MappingsPanelProps {
  sourceId: string;
  links: SourceLinkRow[];
  warehouses: WarehouseOption[];
}

export function MappingsPanel({ sourceId, links, warehouses }: MappingsPanelProps) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">SKU mappings</h3>
            <p className="opacity-70">
              How this source’s external SKUs resolve to your items. A feed row matching one of
              these reconciles that item’s stock.
            </p>
          </div>
          <Badge color="neutral" variant="soft">
            {links.length} mapping{links.length === 1 ? '' : 's'}
          </Badge>
        </div>
        <div className="flex flex-col gap-4">
          <AddMappingForm sourceId={sourceId} warehouses={warehouses} />

          {links.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              No mappings yet. Add one above, or map an unmapped SKU from the queue.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {links.map((link) => (
                <MappingRow key={link.id} sourceId={sourceId} link={link} />
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function MappingRow({ sourceId, link }: { sourceId: string; link: SourceLinkRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeSourceLinkAction(sourceId, link.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-base-300 flex flex-row items-center justify-between gap-3 rounded border px-3 py-2">
      <div className="flex min-w-0 flex-row flex-wrap items-center gap-3">
        <p className="font-mono text-sm">{externalRef(link.externalSku, link.externalLocation)}</p>
        {link.isStale ? (
          <Badge color="danger" variant="soft" size="sm">
            stale
          </Badge>
        ) : null}
        <p className="text-base-content/70 text-xs">→</p>
        <div className="flex min-w-0 flex-col gap-0">
          <p className="text-sm font-medium">
            {link.variant?.title ?? link.variant?.sku ?? 'Unknown item'}
          </p>
          <p className="text-base-content/70 font-mono text-xs">
            {link.variant?.sku ?? '—'} · {link.warehouse?.name ?? link.warehouse?.code ?? '—'}
          </p>
        </div>
      </div>
      <div className="flex flex-row flex-wrap items-center justify-end gap-2">
        {link.unitsPerExternal > 1 ? (
          <Badge color="neutral" variant="soft" size="sm">
            ×{link.unitsPerExternal}
            {link.externalUom ? ` ${link.externalUom}` : ''}
          </Badge>
        ) : null}
        {link.safetyBuffer > 0 ? (
          <Badge color="info" variant="soft" size="sm">
            buffer {link.safetyBuffer}
          </Badge>
        ) : null}
        {error ? <p className="text-danger text-xs">{error}</p> : null}
        <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AddMappingForm({
  sourceId,
  warehouses,
}: {
  sourceId: string;
  warehouses: WarehouseOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [externalSku, setExternalSku] = React.useState('');
  const [externalLocation, setExternalLocation] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState(warehouses[0]?.id ?? '');
  const [variant, setVariant] = React.useState<PickedVariant | null>(null);
  const [controls, setControls] = React.useState<ControlsState>(EMPTY_CONTROLS);

  function add() {
    if (!externalSku.trim()) {
      setError('Enter the external SKU.');
      return;
    }
    if (!variant) {
      setError('Resolve an item to map to.');
      return;
    }
    if (!warehouseId) {
      setError('Choose a warehouse.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createSourceLinkAction(sourceId, {
        variantId: variant.variantId,
        warehouseId,
        externalSku: externalSku.trim(),
        externalLocation: externalLocation.trim() || null,
        ...controlsToBody(controls),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setExternalSku('');
      setExternalLocation('');
      setVariant(null);
      setControls(EMPTY_CONTROLS);
      router.refresh();
    });
  }

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded border border-dashed p-3">
      <div className="flex flex-row flex-wrap items-end gap-3">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <Label htmlFor="map-external-sku">External SKU</Label>
          <Input
            id="map-external-sku"
            value={externalSku}
            onChange={(e) => setExternalSku(e.target.value)}
            placeholder="As it appears in the feed"
          />
        </div>
        <div className="flex min-w-[8rem] flex-col gap-1">
          <Label htmlFor="map-external-loc">Location</Label>
          <Input
            id="map-external-loc"
            value={externalLocation}
            onChange={(e) => setExternalLocation(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex min-w-[12rem] flex-col gap-1">
          <Label htmlFor="map-warehouse">Warehouse</Label>
          <NativeSelect
            id="map-warehouse"
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

      <MappingControlsFields idPrefix="add-link" state={controls} onChange={setControls} />

      <div className="flex flex-row flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <Label>Map to item</Label>
          <VariantPicker
            variant={variant}
            onResolve={setVariant}
            onClear={() => setVariant(null)}
          />
        </div>
        <Button color="module" onClick={add} disabled={pending}>
          {pending ? 'Adding…' : 'Add mapping'}
        </Button>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
