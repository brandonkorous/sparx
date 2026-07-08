'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Boxes, SlidersHorizontal } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  NativeSelect,
  Table,
} from 'silicaui-react';
import { ModuleProvider } from '@sparx/ui';

import {
  adjustInventoryAction,
  setReorderPolicyAction,
} from '../../../../inventory/_lib/inventory-actions';

interface LevelRow {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  unitCostCents: number | null;
  updatedAt: string;
}

export interface VariantWithLevels {
  variantId: string;
  sku: string;
  variantTitle: string | null;
  levels: LevelRow[];
}

export interface InventoryPanelProps {
  productId: string;
  variantsWithLevels: VariantWithLevels[];
  warehouses: { id: string; code: string; name: string }[];
}

const REASONS = ['recount', 'receive', 'loss', 'damage', 'manual'] as const;
const COL_COUNT = 6;

// The product's Inventory tab. Inventory is its own module (rides on Commerce),
// so the panel wears inventory Amber via a nested ModuleProvider — the
// cross-module wayfinding cue (docs/35 §9). One standard Card + one table,
// grouped by variant, instead of a card-per-variant stack.
export function InventoryPanel({ variantsWithLevels, warehouses }: InventoryPanelProps) {
  const lowStockCount = variantsWithLevels.reduce(
    (n, v) =>
      n + v.levels.filter((l) => l.reorderPoint !== null && l.available <= l.reorderPoint).length,
    0
  );

  return (
    <ModuleProvider module="inventory">
      {warehouses.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No warehouses yet"
              description="Add a warehouse before tracking inventory."
              actions={
                <Button color="module" render={<Link href="/inventory/warehouses/new" />}>
                  Add warehouse
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : variantsWithLevels.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No variants yet"
              description="Add at least one variant on the Variants tab before stocking inventory."
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <div className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Inventory</h3>
                <p className="opacity-70">
                  On hand, allocated, and available per warehouse. Adjustments and reorder edits
                  record an audit-logged movement.
                </p>
              </div>
              {lowStockCount > 0 && (
                <Badge color="warning" variant="soft">
                  {lowStockCount} below reorder
                </Badge>
              )}
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right">Allocated</th>
                  <th className="text-right">Available</th>
                  <th>Reorder</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variantsWithLevels.map((v) => (
                  <React.Fragment key={v.variantId}>
                    <tr className="bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle)]">
                      <td colSpan={COL_COUNT}>
                        <div className="flex flex-row flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium">{v.sku}</span>
                          {v.variantTitle && (
                            <span className="text-base-content/70 text-sm">{v.variantTitle}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {warehouses.map((w) => (
                      <VariantInventoryRow
                        key={w.id}
                        variantId={v.variantId}
                        warehouse={w}
                        level={v.levels.find((l) => l.warehouseId === w.id)}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </ModuleProvider>
  );
}

function VariantInventoryRow({
  variantId,
  warehouse,
  level,
}: {
  variantId: string;
  warehouse: { id: string; code: string; name: string };
  level: LevelRow | undefined;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<'view' | 'adjust' | 'reorder'>('view');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onHand = level?.onHand ?? 0;
  const allocated = level?.allocated ?? 0;
  const available = level?.available ?? 0;
  const reorderPoint = level?.reorderPoint ?? null;
  const belowReorder = reorderPoint !== null && available <= reorderPoint;

  function onAdjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const delta = Number(stringOr(form.get('delta'), '0'));
    if (!Number.isFinite(delta) || delta === 0) {
      setError('Delta must be non-zero');
      return;
    }
    const reason = stringOr(form.get('reason'), 'manual');
    const note = stringOr(form.get('note'), '');
    startTransition(async () => {
      const result = await adjustInventoryAction({
        variantId,
        warehouseId: warehouse.id,
        delta,
        reason,
        ...(note ? { note } : {}),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMode('view');
      router.refresh();
    });
  }

  function onSetReorder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const point = Number(stringOr(form.get('reorderPoint'), '0'));
    const quantity = Number(stringOr(form.get('reorderQuantity'), '0'));
    if (!Number.isFinite(point) || point < 0) {
      setError('Reorder point must be 0 or higher');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Reorder quantity must be positive');
      return;
    }
    startTransition(async () => {
      const result = await setReorderPolicyAction({
        variantId,
        warehouseId: warehouse.id,
        reorderPoint: point,
        reorderQuantity: quantity,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMode('view');
      router.refresh();
    });
  }

  return (
    <>
      <tr>
        <td>
          <div className="flex flex-col gap-0">
            <span className="font-mono text-sm font-medium">{warehouse.code}</span>
            <span className="text-base-content/70 text-xs">{warehouse.name}</span>
          </div>
        </td>
        <td className="text-right tabular-nums">{onHand}</td>
        <td className="text-right tabular-nums">{allocated}</td>
        <td className="text-right tabular-nums">
          {belowReorder ? <span className="text-warning font-medium">{available}</span> : available}
        </td>
        <td>
          {reorderPoint === null ? (
            <span className="text-base-content/70 text-xs">none</span>
          ) : belowReorder ? (
            <Badge color="warning" variant="soft" size="sm">
              ≤ {reorderPoint}
            </Badge>
          ) : (
            <span className="text-base-content/70 text-sm tabular-nums">≤ {reorderPoint}</span>
          )}
        </td>
        <td className="text-right">
          <div className="flex flex-row justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'adjust' ? 'view' : 'adjust')}
              iconStart={<SlidersHorizontal className="h-3.5 w-3.5" />}
            >
              Adjust
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'reorder' ? 'view' : 'reorder')}
              iconStart={<Bell className="h-3.5 w-3.5" />}
            >
              Reorder
            </Button>
          </div>
        </td>
      </tr>
      {mode === 'adjust' && (
        <tr>
          <td colSpan={COL_COUNT} className="bg-[var(--color-bg-subtle)]">
            <form onSubmit={onAdjust}>
              <div className="flex flex-row flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-base-content/70 text-xs">Delta (±)</span>
                  <Input name="delta" defaultValue="0" className="w-[6rem]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-base-content/70 text-xs">Reason</span>
                  <NativeSelect name="reason" defaultValue="manual" size="sm" className="w-[10rem]">
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                  <span className="text-base-content/70 text-xs">Note</span>
                  <Input name="note" placeholder="optional" />
                </div>
                <div className="flex flex-row gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setMode('view')}>
                    Cancel
                  </Button>
                  <Button
                    color="module"
                    size="sm"
                    type="submit"
                    disabled={pending}
                    loading={pending}
                  >
                    Apply
                  </Button>
                </div>
              </div>
              {error && <p className="text-danger mt-2 text-xs">{error}</p>}
            </form>
          </td>
        </tr>
      )}
      {mode === 'reorder' && (
        <tr>
          <td colSpan={COL_COUNT} className="bg-[var(--color-bg-subtle)]">
            <form onSubmit={onSetReorder}>
              <div className="flex flex-row flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-base-content/70 text-xs">Reorder point</span>
                  <Input
                    name="reorderPoint"
                    defaultValue={reorderPoint?.toString() ?? '0'}
                    className="w-[6rem]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-base-content/70 text-xs">Reorder qty</span>
                  <Input
                    name="reorderQuantity"
                    defaultValue={level?.reorderQuantity?.toString() ?? ''}
                    className="w-[6rem]"
                  />
                </div>
                <div className="flex flex-row gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setMode('view')}>
                    Cancel
                  </Button>
                  <Button
                    color="module"
                    size="sm"
                    type="submit"
                    disabled={pending}
                    loading={pending}
                  >
                    Save policy
                  </Button>
                </div>
              </div>
              {error && <p className="text-danger mt-2 text-xs">{error}</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function stringOr(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
