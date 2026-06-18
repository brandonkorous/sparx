'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import {
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

import { createInventoryTransferAction } from '../../../_lib/transfer-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface PickedLine {
  variantId: string;
  sku: string;
  title: string | null;
  quantity: number;
}

// New-transfer form. Pick the source + destination warehouse, add the items to move
// (by SKU, with a quantity each), and create the draft. The detail screen then ships
// → receives. Source and destination must differ.

export function TransferCreateForm({ warehouses }: { warehouses: WarehouseOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fromId, setFromId] = React.useState(warehouses[0]?.id ?? '');
  const [toId, setToId] = React.useState(warehouses[1]?.id ?? '');
  const [lines, setLines] = React.useState<PickedLine[]>([]);

  function addLine(line: PickedLine) {
    setLines((prev) => (prev.some((p) => p.variantId === line.variantId) ? prev : [...prev, line]));
  }
  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((p) => p.variantId !== variantId));
  }
  function setQuantity(variantId: string, quantity: number) {
    setLines((prev) => prev.map((p) => (p.variantId === variantId ? { ...p, quantity } : p)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!fromId || !toId) {
      setError('Choose a source and destination warehouse.');
      return;
    }
    if (fromId === toId) {
      setError('Source and destination must be different warehouses.');
      return;
    }
    const form = new FormData(e.currentTarget);
    const note = str(form.get('note'));
    const input = {
      fromWarehouseId: fromId,
      toWarehouseId: toId,
      ...(note ? { note } : {}),
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    };

    startTransition(async () => {
      const result = await createInventoryTransferAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/transfers/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Route</Heading>
            <CardDescription>
              Choose where the stock moves from and to. You can add the items now or once the
              transfer is open.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} align="end" wrap>
              <Stack gap={1} className="min-w-[14rem] flex-1">
                <Label htmlFor="fromWarehouse">From</Label>
                <NativeSelect
                  id="fromWarehouse"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </Stack>
              <ArrowRight className="mb-2 h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
              <Stack gap={1} className="min-w-[14rem] flex-1">
                <Label htmlFor="toWarehouse">To</Label>
                <NativeSelect
                  id="toWarehouse"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </Stack>
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="note">Note</Label>
              <textarea
                id="note"
                name="note"
                rows={2}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <LinePicker
        lines={lines}
        onAdd={addLine}
        onRemove={removeLine}
        onQty={setQuantity}
        busy={pending}
      />

      <Stack direction="row" gap={2} align="center" justify="between" className="mt-6 w-full">
        {error && (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        )}
        <Stack direction="row" gap={2} className="ml-auto">
          <Button type="button" variant="ghost" asChild>
            <Link href="/inventory/transfers">Cancel</Link>
          </Button>
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create transfer'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

function LinePicker({
  lines,
  onAdd,
  onRemove,
  onQty,
  busy,
}: {
  lines: PickedLine[];
  onAdd: (line: PickedLine) => void;
  onRemove: (variantId: string) => void;
  onQty: (variantId: string, quantity: number) => void;
  busy: boolean;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <Stack gap={1}>
          <Heading level={3}>Items to move</Heading>
          <CardDescription>
            Add the variants to transfer by SKU and set a quantity. You can also add more once the
            transfer is open.
          </CardDescription>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          {lines.length === 0 ? (
            <Text size="sm" variant="muted">
              No items yet — add a SKU below, or start empty and add them on the next screen.
            </Text>
          ) : (
            <Stack gap={2}>
              {lines.map((l) => (
                <Stack
                  key={l.variantId}
                  direction="row"
                  align="center"
                  gap={3}
                  wrap
                  className="rounded border border-[var(--color-border-default)] px-3 py-2"
                >
                  <Stack gap={0} className="min-w-[12rem] flex-1">
                    <Text size="sm" className="font-medium">
                      {l.title ?? l.sku}
                    </Text>
                    <Text size="xs" variant="muted" className="font-mono">
                      {l.sku}
                    </Text>
                  </Stack>
                  <Stack gap={0} className="w-[6rem]">
                    <Label htmlFor={`qty-${l.variantId}`} className="sr-only">
                      Quantity
                    </Label>
                    <Input
                      id={`qty-${l.variantId}`}
                      type="number"
                      min={1}
                      value={l.quantity}
                      aria-label="Quantity"
                      onChange={(e) =>
                        onQty(l.variantId, Math.max(1, Math.round(Number(e.target.value))))
                      }
                    />
                  </Stack>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => onRemove(l.variantId)}
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
          <SkuAddRow onAdd={onAdd} disabled={busy} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function SkuAddRow({ onAdd, disabled }: { onAdd: (line: PickedLine) => void; disabled?: boolean }) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    const sku = value.trim();
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        setBusy(false);
        return;
      }
      onAdd({
        variantId: lookup.data.variantId,
        sku: lookup.data.sku,
        title: lookup.data.productTitle,
        quantity: 1,
      });
      setValue('');
      setBusy(false);
    })();
  }

  return (
    <Stack gap={2}>
      <Stack
        direction="row"
        gap={3}
        align="end"
        wrap
        className="rounded border border-dashed border-[var(--color-border-default)] p-3"
      >
        <Stack gap={1} className="min-w-[12rem] flex-1">
          <Label htmlFor="transfer-add-sku">Variant SKU</Label>
          <Input
            id="transfer-add-sku"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. FUEL-FILTER-1"
          />
        </Stack>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </Stack>
      {error && (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
