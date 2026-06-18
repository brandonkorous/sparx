'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';

import { createSourceLinkAction, removeSourceLinkAction } from '../../../_lib/sync-actions';
import { VariantPicker, type PickedVariant } from './variant-picker';
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
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Stack gap={1}>
            <Heading level={3}>SKU mappings</Heading>
            <CardDescription>
              How this source’s external SKUs resolve to your items. A feed row matching one of
              these reconciles that item’s stock.
            </CardDescription>
          </Stack>
          <Badge color="neutral" variant="soft">
            {links.length} mapping{links.length === 1 ? '' : 's'}
          </Badge>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          <AddMappingForm sourceId={sourceId} warehouses={warehouses} />

          {links.length === 0 ? (
            <Text size="sm" variant="muted">
              No mappings yet. Add one above, or map an unmapped SKU from the queue.
            </Text>
          ) : (
            <Stack gap={1}>
              {links.map((link) => (
                <MappingRow key={link.id} sourceId={sourceId} link={link} />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
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
    <Stack
      direction="row"
      align="center"
      justify="between"
      gap={3}
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Stack direction="row" align="center" gap={3} wrap className="min-w-0">
        <Text size="sm" className="font-mono">
          {externalRef(link.externalSku, link.externalLocation)}
        </Text>
        <Text size="xs" variant="muted">
          →
        </Text>
        <Stack gap={0} className="min-w-0">
          <Text size="sm" className="font-medium">
            {link.variant?.title ?? link.variant?.sku ?? 'Unknown item'}
          </Text>
          <Text size="xs" variant="muted" className="font-mono">
            {link.variant?.sku ?? '—'} · {link.warehouse?.name ?? link.warehouse?.code ?? '—'}
          </Text>
        </Stack>
      </Stack>
      <Stack direction="row" align="center" gap={2}>
        {error ? (
          <Text size="xs" className="text-[var(--color-danger)]">
            {error}
          </Text>
        ) : null}
        <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
          <Trash2 className="size-4" />
        </Button>
      </Stack>
    </Stack>
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
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setExternalSku('');
      setExternalLocation('');
      setVariant(null);
      router.refresh();
    });
  }

  return (
    <Stack
      gap={3}
      className="rounded border border-dashed border-[var(--color-border-default)] p-3"
    >
      <Stack direction="row" gap={3} wrap align="end">
        <Stack gap={1} className="min-w-[10rem] flex-1">
          <Label htmlFor="map-external-sku">External SKU</Label>
          <Input
            id="map-external-sku"
            value={externalSku}
            onChange={(e) => setExternalSku(e.target.value)}
            placeholder="As it appears in the feed"
          />
        </Stack>
        <Stack gap={1} className="min-w-[8rem]">
          <Label htmlFor="map-external-loc">Location</Label>
          <Input
            id="map-external-loc"
            value={externalLocation}
            onChange={(e) => setExternalLocation(e.target.value)}
            placeholder="Optional"
          />
        </Stack>
        <Stack gap={1} className="min-w-[12rem]">
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
        </Stack>
      </Stack>
      <Stack direction="row" gap={3} wrap align="end" justify="between">
        <Stack gap={1} className="min-w-[16rem] flex-1">
          <Label>Map to item</Label>
          <VariantPicker
            variant={variant}
            onResolve={setVariant}
            onClear={() => setVariant(null)}
          />
        </Stack>
        <Button color="module" onClick={add} disabled={pending}>
          {pending ? 'Adding…' : 'Add mapping'}
        </Button>
      </Stack>
      {error ? (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
