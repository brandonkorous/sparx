'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Boxes, SlidersHorizontal } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Heading,
  Input,
  ModuleProvider,
  NativeSelect,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

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
        <Card variant="module">
          <CardContent>
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No warehouses yet"
              description="Add a warehouse before tracking inventory."
              action={
                <Button color="module" asChild>
                  <Link href="/inventory/warehouses/new">Add warehouse</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : variantsWithLevels.length === 0 ? (
        <Card variant="module">
          <CardContent>
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No variants yet"
              description="Add at least one variant on the Variants tab before stocking inventory."
            />
          </CardContent>
        </Card>
      ) : (
        <Card variant="module">
          <CardHeader>
            <Stack direction="row" align="start" justify="between" wrap gap={3}>
              <Stack gap={1}>
                <Heading level={3}>Inventory</Heading>
                <CardDescription>
                  On hand, allocated, and available per warehouse. Adjustments and reorder edits
                  record an audit-logged movement.
                </CardDescription>
              </Stack>
              {lowStockCount > 0 && (
                <Badge color="warning" variant="soft">
                  {lowStockCount} below reorder
                </Badge>
              )}
            </Stack>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Reorder</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantsWithLevels.map((v) => (
                  <React.Fragment key={v.variantId}>
                    <TableRow className="bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle)]">
                      <TableCell colSpan={COL_COUNT}>
                        <Stack direction="row" align="center" gap={2} wrap>
                          <Text size="sm" weight="medium" className="font-mono">
                            {v.sku}
                          </Text>
                          {v.variantTitle && (
                            <Text size="sm" variant="muted">
                              {v.variantTitle}
                            </Text>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
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
              </TableBody>
            </Table>
          </CardContent>
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
      <TableRow>
        <TableCell>
          <Stack gap={0}>
            <Text size="sm" weight="medium" className="font-mono">
              {warehouse.code}
            </Text>
            <Text size="xs" variant="muted">
              {warehouse.name}
            </Text>
          </Stack>
        </TableCell>
        <TableCell className="text-right tabular-nums">{onHand}</TableCell>
        <TableCell className="text-right tabular-nums">{allocated}</TableCell>
        <TableCell className="text-right tabular-nums">
          {belowReorder ? (
            <Text as="span" variant="warning" weight="medium">
              {available}
            </Text>
          ) : (
            available
          )}
        </TableCell>
        <TableCell>
          {reorderPoint === null ? (
            <Text size="xs" variant="muted">
              none
            </Text>
          ) : belowReorder ? (
            <Badge color="warning" variant="soft" size="sm">
              ≤ {reorderPoint}
            </Badge>
          ) : (
            <Text size="sm" variant="muted" className="tabular-nums">
              ≤ {reorderPoint}
            </Text>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Stack direction="row" gap={1} justify="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'adjust' ? 'view' : 'adjust')}
              leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            >
              Adjust
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'reorder' ? 'view' : 'reorder')}
              leftIcon={<Bell className="h-3.5 w-3.5" />}
            >
              Reorder
            </Button>
          </Stack>
        </TableCell>
      </TableRow>
      {mode === 'adjust' && (
        <TableRow>
          <TableCell colSpan={COL_COUNT} className="bg-[var(--color-bg-subtle)]">
            <form onSubmit={onAdjust}>
              <Stack direction="row" gap={3} align="end" wrap>
                <Stack gap={1}>
                  <Text size="xs" variant="muted">
                    Delta (±)
                  </Text>
                  <Input name="delta" defaultValue="0" className="w-[6rem]" />
                </Stack>
                <Stack gap={1}>
                  <Text size="xs" variant="muted">
                    Reason
                  </Text>
                  <NativeSelect name="reason" defaultValue="manual" size="sm" className="w-[10rem]">
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                </Stack>
                <Stack gap={1} className="min-w-[14rem] flex-1">
                  <Text size="xs" variant="muted">
                    Note
                  </Text>
                  <Input name="note" placeholder="optional" />
                </Stack>
                <Stack direction="row" gap={2}>
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
                </Stack>
              </Stack>
              {error && (
                <Text size="xs" variant="danger" className="mt-2">
                  {error}
                </Text>
              )}
            </form>
          </TableCell>
        </TableRow>
      )}
      {mode === 'reorder' && (
        <TableRow>
          <TableCell colSpan={COL_COUNT} className="bg-[var(--color-bg-subtle)]">
            <form onSubmit={onSetReorder}>
              <Stack direction="row" gap={3} align="end" wrap>
                <Stack gap={1}>
                  <Text size="xs" variant="muted">
                    Reorder point
                  </Text>
                  <Input
                    name="reorderPoint"
                    defaultValue={reorderPoint?.toString() ?? '0'}
                    className="w-[6rem]"
                  />
                </Stack>
                <Stack gap={1}>
                  <Text size="xs" variant="muted">
                    Reorder qty
                  </Text>
                  <Input
                    name="reorderQuantity"
                    defaultValue={level?.reorderQuantity?.toString() ?? ''}
                    className="w-[6rem]"
                  />
                </Stack>
                <Stack direction="row" gap={2}>
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
                </Stack>
              </Stack>
              {error && (
                <Text size="xs" variant="danger" className="mt-2">
                  {error}
                </Text>
              )}
            </form>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function stringOr(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
